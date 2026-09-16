import os
import argparse
import numpy as np
import torch
from torch.utils.data import DataLoader

import daisee_config
from daisee_dataset import DAiSEEDataset
from models_pytorch import DAiSEEEfficientNet

def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate DAiSEE Learning-Affect Model")
    parser.add_argument("--dataset_dir", type=str, default=daisee_config.DATASET_DIR, help="Path to DAiSEE dataset")
    parser.add_argument("--batch_size", type=str, default="8", help="Batch size")
    parser.add_argument("--num_frames", type=str, default=str(daisee_config.NUM_FRAMES), help="Number of sampled frames")
    parser.add_argument("--model_path", type=str, default=daisee_config.MODEL_PATH, help="Path to best model checkpoint")
    return parser.parse_args()

def load_model_weights(model, checkpoint_path, device):
    """Loads model weights from the saved checkpoint (state_dict format)."""
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Model checkpoint not found at {checkpoint_path}")
        
    print(f"Loading model weights from {checkpoint_path}...")
    checkpoint = torch.load(checkpoint_path, map_location=device)
    
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        state_dict = checkpoint["model_state_dict"]
    else:
        # Check if saved object is the raw state_dict or model object
        state_dict = checkpoint.state_dict() if hasattr(checkpoint, "state_dict") else checkpoint
        
    model.load_state_dict(state_dict)
    print("Model weights loaded successfully.")

def evaluate(model, loader, device):
    model.eval()
    correct = [0] * 4
    total = 0
    
    # Track classifications per category (confusion matrices or lists of preds/targets for richer reporting)
    all_preds = [[] for _ in range(4)]
    all_labels = [[] for _ in range(4)]
    
    with torch.no_grad():
        for inputs, labels in loader:
            inputs = inputs.to(device)
            labels = labels.to(device)
            
            logits = model(inputs)  # [batch_size, 4, 4]
            
            total += inputs.size(0)
            
            for i in range(4):
                preds = torch.argmax(logits[:, i, :], dim=1)
                correct[i] += (preds == labels[:, i]).sum().item()
                
                all_preds[i].extend(preds.cpu().numpy())
                all_labels[i].extend(labels[:, i].cpu().numpy())
                
    accuracies = [c / total for c in correct]
    
    return accuracies, total, all_preds, all_labels

def main():
    args = parse_args()
    
    dataset_dir = args.dataset_dir
    batch_size = int(args.batch_size)
    num_frames = int(args.num_frames)
    
    test_csv = os.path.join(dataset_dir, "Labels", "TestLabels.csv")
    if not os.path.exists(test_csv):
        test_csv = os.path.join(dataset_dir, "TestLabels.csv")
        
    if not os.path.exists(test_csv):
        print(f"Warning: Test CSV not found at {test_csv}. Check configurations.")
        # Attempt to run dummy evaluation if directory was empty and auto-created
        
    # Device setup
    if torch.cuda.is_available():
        device = torch.device("cuda")
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")
    print(f"Using device: {device}")
    
    # Load test dataset
    print("Loading test dataset...")
    test_dataset = DAiSEEDataset(
        csv_file=test_csv,
        video_dir=os.path.join(dataset_dir, "Test"),
        num_frames=num_frames,
        is_training=False
    )
    
    if len(test_dataset) == 0:
        print("Error: Test dataset contains no samples. Cannot evaluate.")
        return
        
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
    
    # Instantiate and load model
    model = DAiSEEEfficientNet(pretrained=False).to(device)
    
    try:
        load_model_weights(model, args.model_path, device)
    except Exception as e:
        print(f"Failed to load trained model checkpoint: {e}")
        print("Note: Run train.py first to generate the trained model.")
        return
        
    # Evaluate
    print("Running evaluation on test set...")
    accuracies, total_samples, all_preds, all_labels = evaluate(model, test_loader, device)
    
    categories = ["Boredom", "Engagement", "Confusion", "Frustration"]
    
    print("\n" + "="*50)
    print("                 DAiSEE Evaluation Results")
    print("="*50)
    print(f"Total Test Samples Evaluated: {total_samples}")
    print("-"*50)
    
    for i, category in enumerate(categories):
        print(f"  {category:<15} Accuracy: {accuracies[i]:.4f} ({accuracies[i]*100:.2f}%)")
        
    avg_acc = np.mean(accuracies)
    print("-"*50)
    print(f"  Average Accuracy:          {avg_acc:.4f} ({avg_acc*100:.2f}%)")
    print("="*50)

if __name__ == "__main__":
    main()
