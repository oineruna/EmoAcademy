import os
import time
import argparse
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torch.optim import AdamW

import daisee_config
from daisee_dataset import DAiSEEDataset
from models_pytorch import DAiSEEEfficientNet

def parse_args():
    parser = argparse.ArgumentParser(description="Train DAiSEE Learning-Affect Recognition Model")
    parser.add_argument("--dataset_dir", type=str, default=daisee_config.DATASET_DIR, help="Path to DAiSEE dataset")
    parser.add_argument("--epochs", type=str, default=str(daisee_config.EPOCHS), help="Number of training epochs")
    parser.add_argument("--batch_size", type=str, default=str(daisee_config.BATCH_SIZE), help="Batch size")
    parser.add_argument("--lr", type=str, default=str(daisee_config.LEARNING_RATE), help="Learning rate")
    parser.add_argument("--num_frames", type=str, default=str(daisee_config.NUM_FRAMES), help="Number of sampled frames")
    parser.add_argument("--pretrained_checkpoint", type=str, default=daisee_config.PRETRAINED_CHECKPOINT, help="Pretrained checkpoint path")
    parser.add_argument("--model_path", type=str, default=daisee_config.MODEL_PATH, help="Path to save best model")
    return parser.parse_args()

def generate_mock_dataset_if_missing(dataset_dir):
    """Generates a small mock DAiSEE directory structure and files for testing and dry-run compatibility."""
    labels_dir = os.path.join(dataset_dir, "Labels")
    os.makedirs(labels_dir, exist_ok=True)
    
    splits = ["Train", "Validation", "Test"]
    csv_paths = {
        "Train": os.path.join(labels_dir, "TrainLabels.csv"),
        "Validation": os.path.join(labels_dir, "ValidationLabels.csv"),
        "Test": os.path.join(labels_dir, "TestLabels.csv")
    }
    
    # Generate dummy CSV files
    mock_files = []
    for split, csv_path in csv_paths.items():
        split_dir = os.path.join(dataset_dir, split)
        os.makedirs(split_dir, exist_ok=True)
        
        if not os.path.exists(csv_path):
            print(f"Generating mock CSV for {split} split at {csv_path}...")
            data = []
            # Create a few dummy clip IDs
            for i in range(1, 6):
                clip_id = f"110001{split[0]}00{i}"
                boredom = np.random.randint(0, 4)
                engagement = np.random.randint(0, 4)
                confusion = np.random.randint(0, 4)
                frustration = np.random.randint(0, 4)
                data.append([clip_id, boredom, engagement, confusion, frustration])
                
                # Create a small dummy video file if it doesn't exist
                video_name = f"{clip_id}.avi"
                user_folder = os.path.join(split_dir, f"110001")
                os.makedirs(user_folder, exist_ok=True)
                video_path = os.path.join(user_folder, video_name)
                
                if not os.path.exists(video_path):
                    import cv2
                    # Create a dummy 1-second video (30 frames) of black frames
                    fourcc = cv2.VideoWriter_fourcc(*'XVID')
                    out = cv2.VideoWriter(video_path, fourcc, 30.0, (320, 240))
                    for _ in range(30):
                        frame = np.zeros((240, 320, 3), dtype=np.uint8)
                        out.write(frame)
                    out.release()
                    mock_files.append(video_path)
            
            df = pd.DataFrame(data, columns=["ClipID", "Boredom", "Engagement", "Confusion", "Frustration"])
            df.to_csv(csv_path, index=False)
            
    if mock_files:
        print(f"Generated {len(mock_files)} mock video files for testing.")

def load_pretrained_weights(model, checkpoint_path):
    """
    Attempts to load the backbone weights from the previous AffectNet model.
    Filters out keys with mismatched shapes or linear head prefixes.
    """
    if not os.path.exists(checkpoint_path):
        print(f"Pretrained checkpoint not found at {checkpoint_path}. Starting with default timm weights.")
        return
        
    print(f"Loading pretrained weights from {checkpoint_path}...")
    try:
        # Load the checkpoint object
        checkpoint = torch.load(checkpoint_path, map_location="cpu")
        
        # Extract the state dict
        if isinstance(checkpoint, dict):
            state_dict = checkpoint.get("state_dict", checkpoint)
        elif hasattr(checkpoint, "state_dict"):
            state_dict = checkpoint.state_dict()
        else:
            print("Could not extract state_dict from checkpoint. Skipping.")
            return
            
        model_state = model.state_dict()
        matching_state = {}
        mismatched_shapes = []
        ignored_keys = []
        
        for k, v in state_dict.items():
            # Skip the classifier/head layer
            if "classifier" in k or "head" in k:
                ignored_keys.append(k)
                continue
                
            # If the checkpoint is a flat model and our model wraps the backbone inside 'backbone'
            target_key = k if k.startswith("backbone.") else f"backbone.{k}"
            
            if target_key in model_state:
                if model_state[target_key].shape == v.shape:
                    matching_state[target_key] = v
                else:
                    mismatched_shapes.append((target_key, v.shape, model_state[target_key].shape))
            else:
                ignored_keys.append(k)
                
        # Load matched keys
        if matching_state:
            model.load_state_dict(matching_state, strict=False)
            loaded_percent = 100.0 * len(matching_state) / len(model_state)
            print(f"Successfully loaded {len(matching_state)} backbone parameter keys ({loaded_percent:.2f}% of model).")
        else:
            print("No matching weights loaded.")
            
        if mismatched_shapes:
            print(f"Found {len(mismatched_shapes)} keys with mismatched shapes (e.g. B0 vs B2 size difference).")
            # Print a few examples
            for tk, s1, s2 in mismatched_shapes[:5]:
                print(f"  Shape mismatch for {tk}: Checkpoint shape {s1} vs Model shape {s2}")
                
    except Exception as e:
        print(f"Error loading pretrained weights: {e}. Falling back to default timm weights.")

def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss = 0.0
    correct = [0] * 4
    total = 0
    
    for step, (inputs, labels) in enumerate(loader):
        inputs = inputs.to(device)
        labels = labels.to(device)  # [batch_size, 4]
        
        optimizer.zero_grad()
        logits = model(inputs)  # [batch_size, 4, 4]
        
        # Calculate loss for each category and average them
        # Labels shape is [batch_size, 4] where labels[:, i] corresponds to category i
        loss_boredom = criterion(logits[:, 0, :], labels[:, 0])
        loss_engagement = criterion(logits[:, 1, :], labels[:, 1])
        loss_confusion = criterion(logits[:, 2, :], labels[:, 2])
        loss_frustration = criterion(logits[:, 3, :], labels[:, 3])
        
        loss = (loss_boredom + loss_engagement + loss_confusion + loss_frustration) / 4.0
        
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item() * inputs.size(0)
        total += inputs.size(0)
        
        # Calculate training accuracy per task
        for i in range(4):
            preds = torch.argmax(logits[:, i, :], dim=1)
            correct[i] += (preds == labels[:, i]).sum().item()
            
    epoch_loss = total_loss / total
    epoch_accs = [c / total for c in correct]
    
    return epoch_loss, epoch_accs

def validate(model, loader, criterion, device):
    model.eval()
    total_loss = 0.0
    correct = [0] * 4
    total = 0
    
    with torch.no_grad():
        for inputs, labels in loader:
            inputs = inputs.to(device)
            labels = labels.to(device)
            
            logits = model(inputs)
            
            loss_boredom = criterion(logits[:, 0, :], labels[:, 0])
            loss_engagement = criterion(logits[:, 1, :], labels[:, 1])
            loss_confusion = criterion(logits[:, 2, :], labels[:, 2])
            loss_frustration = criterion(logits[:, 3, :], labels[:, 3])
            
            loss = (loss_boredom + loss_engagement + loss_confusion + loss_frustration) / 4.0
            
            total_loss += loss.item() * inputs.size(0)
            total += inputs.size(0)
            
            for i in range(4):
                preds = torch.argmax(logits[:, i, :], dim=1)
                correct[i] += (preds == labels[:, i]).sum().item()
                
    val_loss = total_loss / total
    val_accs = [c / total for c in correct]
    
    return val_loss, val_accs

def main():
    args = parse_args()
    
    # Resolve hyperparams from args/configs
    dataset_dir = args.dataset_dir
    epochs = int(args.epochs)
    batch_size = int(args.batch_size)
    lr = float(args.lr)
    num_frames = int(args.num_frames)
    
    # Auto-generate mock dataset if directory is missing or empty
    if not os.path.exists(dataset_dir) or not os.listdir(dataset_dir):
        print(f"DAiSEE dataset directory '{dataset_dir}' not found or empty.")
        generate_mock_dataset_if_missing(dataset_dir)
        
    # Resolve CSV labels path based on structure
    train_csv = os.path.join(dataset_dir, "Labels", "TrainLabels.csv")
    val_csv = os.path.join(dataset_dir, "Labels", "ValidationLabels.csv")
    
    if not os.path.exists(train_csv):
        train_csv = os.path.join(dataset_dir, "TrainLabels.csv")
    if not os.path.exists(val_csv):
        val_csv = os.path.join(dataset_dir, "ValidationLabels.csv")
        
    # Device setup
    if torch.cuda.is_available():
        device = torch.device("cuda")
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")
    print(f"Using device: {device}")
    
    # Load Datasets
    print("Loading datasets...")
    train_dataset = DAiSEEDataset(
        csv_file=train_csv,
        video_dir=os.path.join(dataset_dir, "Train"),
        num_frames=num_frames,
        is_training=True
    )
    val_dataset = DAiSEEDataset(
        csv_file=val_csv,
        video_dir=os.path.join(dataset_dir, "Validation"),
        num_frames=num_frames,
        is_training=False
    )
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0, drop_last=False)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
    
    # Instantiate Model
    print("Instantiating DAiSEEEfficientNet model (EfficientNet-B2)...")
    model = DAiSEEEfficientNet(pretrained=True).to(device)
    
    # Load Pretrained Weights
    load_pretrained_weights(model, args.pretrained_checkpoint)
    
    # Optimizer and Loss
    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=1e-2)
    criterion = nn.CrossEntropyLoss()
    
    # Track performance
    best_avg_acc = 0.0
    
    print("Starting training loop...")
    for epoch in range(epochs):
        start_time = time.time()
        
        train_loss, train_accs = train_epoch(model, train_loader, optimizer, criterion, device)
        val_loss, val_accs = validate(model, val_loader, criterion, device)
        
        avg_train_acc = np.mean(train_accs)
        avg_val_acc = np.mean(val_accs)
        
        epoch_time = time.time() - start_time
        
        print(f"Epoch {epoch+1:02d}/{epochs:02d} | Time: {epoch_time:.1f}s")
        print(f"  Train Loss: {train_loss:.4f} | Avg Train Acc: {avg_train_acc:.4f}")
        print(f"    - Boredom: {train_accs[0]:.4f} | Engagement: {train_accs[1]:.4f} | Confusion: {train_accs[2]:.4f} | Frustration: {train_accs[3]:.4f}")
        print(f"  Val Loss:   {val_loss:.4f} | Avg Val Acc:   {avg_val_acc:.4f}")
        print(f"    - Boredom: {val_accs[0]:.4f} | Engagement: {val_accs[1]:.4f} | Confusion: {val_accs[2]:.4f} | Frustration: {val_accs[3]:.4f}")
        
        # Save model if validation performance improved
        if avg_val_acc > best_avg_acc:
            best_avg_acc = avg_val_acc
            print(f"  --> Saving new best model to {args.model_path} (Avg Val Acc: {best_avg_acc:.4f})")
            
            # Save state dict
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'best_avg_acc': best_avg_acc,
                'num_frames': num_frames,
                'image_size': daisee_config.IMAGE_SIZE
            }, args.model_path)
            
            # Also save full model object for easy load_model in predictor
            torch.save(model, args.model_path + ".full.pt")

    print(f"Training complete! Best average validation accuracy: {best_avg_acc:.4f}")

if __name__ == "__main__":
    main()
