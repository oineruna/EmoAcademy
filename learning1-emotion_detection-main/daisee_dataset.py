import os
import cv2
import pandas as pd
import numpy as np
import torch
from torch.utils.data import Dataset
from PIL import Image
import daisee_config

class DAiSEEDataset(Dataset):
    """
    Dataset loader for the DAiSEE (Dataset for Affective States in E-learning Environments).
    Reads video files, samples a fixed number of frames, crops faces, and outputs:
    - video frames: [num_frames, channels, height, width]
    - labels: [4] corresponding to [boredom, engagement, confusion, frustration]
    """
    def __init__(self, csv_file, video_dir, num_frames=daisee_config.NUM_FRAMES, image_size=daisee_config.IMAGE_SIZE, transform=None, is_training=True):
        self.csv_file = csv_file
        self.video_dir = video_dir
        self.num_frames = num_frames
        self.image_size = image_size
        self.transform = transform
        self.is_training = is_training
        
        # Load Haar Cascade for face detection crop
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        
        # Load CSV labels
        if not os.path.exists(csv_file):
            print(f"Warning: CSV file not found at {csv_file}. Generating dummy data index for testing.")
            self.df = pd.DataFrame(columns=["ClipID", "Boredom", "Engagement", "Confusion", "Frustration"])
            self.video_paths = {}
        else:
            self.df = pd.read_csv(csv_file)
            # Strip whitespace from column names to handle potential format inconsistencies
            self.df.columns = [c.strip() for c in self.df.columns]
            
            # Map column names case-insensitively
            col_mapping = {c.lower(): c for c in self.df.columns}
            self.clip_id_col = col_mapping.get("clipid", "ClipID")
            self.boredom_col = col_mapping.get("boredom", "Boredom")
            self.engagement_col = col_mapping.get("engagement", "Engagement")
            self.confusion_col = col_mapping.get("confusion", "Confusion")
            self.frustration_col = col_mapping.get("frustration", "Frustration")
            
            # Clean up the labels (convert to int, handle NaN)
            for col in [self.boredom_col, self.engagement_col, self.confusion_col, self.frustration_col]:
                self.df[col] = pd.to_numeric(self.df[col], errors='coerce').fillna(0).astype(int)
            
            # Recursively scan the video directory to match ClipID to absolute file paths.
            # This handles nesting like Train/110001/1100011002.avi or similar.
            self.video_paths = self._find_all_videos(video_dir)
            
            # Filter the dataframe to only include clips that actually exist on disk
            initial_count = len(self.df)
            self.df['exists'] = self.df[self.clip_id_col].apply(lambda x: self._check_clip_exists(x))
            self.df = self.df[self.df['exists'] == True].reset_index(drop=True)
            print(f"Loaded {len(self.df)}/{initial_count} video samples from split directory {video_dir}")

    def _find_all_videos(self, directory):
        """Recursively scans directory and builds a dictionary mapping filename (without extension) to its absolute path."""
        video_paths = {}
        if not os.path.exists(directory):
            return video_paths
        for root, _, files in os.walk(directory):
            for file in files:
                if file.lower().endswith(('.mp4', '.avi', '.mkv', '.mov', '.wmv')):
                    base_name = os.path.splitext(file)[0]
                    video_paths[base_name] = os.path.join(root, file)
                    # Also map with extension just in case ClipID retains it
                    video_paths[file] = os.path.join(root, file)
        return video_paths

    def _check_clip_exists(self, clip_id):
        clip_str = str(clip_id).strip()
        # Direct check
        if clip_str in self.video_paths:
            return True
        # Check without extension if clip_str has extension
        base_name = os.path.splitext(clip_str)[0]
        if base_name in self.video_paths:
            return True
        return False

    def _get_video_path(self, clip_id):
        clip_str = str(clip_id).strip()
        if clip_str in self.video_paths:
            return self.video_paths[clip_str]
        base_name = os.path.splitext(clip_str)[0]
        return self.video_paths.get(base_name, None)

    def __len__(self):
        return len(self.df)

    def _crop_face(self, frame):
        """Detect and crop the face region. Fallback to center crop if no face detected."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(60, 60))
        if len(faces) > 0:
            # Crop the largest detected face
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            # Add some margin around the face
            h_margin = int(w * 0.1)
            v_margin = int(h * 0.1)
            H, W, _ = frame.shape
            x1 = max(0, x - h_margin)
            y1 = max(0, y - v_margin)
            x2 = min(W, x + w + h_margin)
            y2 = min(H, y + h + v_margin)
            return frame[y1:y2, x1:x2]
        
        # Center crop fallback
        H, W, _ = frame.shape
        crop_size = min(H, W)
        start_x = (W - crop_size) // 2
        start_y = (H - crop_size) // 2
        return frame[start_y:start_y + crop_size, start_x:start_x + crop_size]

    def _load_video_frames(self, video_path):
        """Opens video, samples num_frames, crops face using first-frame bbox or detection, resizes and normalizes."""
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        if total_frames <= 0:
            cap.release()
            # Return dummy zero frames if video is corrupted
            return torch.zeros((self.num_frames, 3, self.image_size, self.image_size), dtype=torch.float32)
            
        # Select frame indices to sample
        indices = np.linspace(0, total_frames - 1, self.num_frames, dtype=int)
        
        frames = []
        success_count = 0
        
        # Run face detection on the first frame to get a bounding box for tracking
        cap.set(cv2.CAP_PROP_POS_FRAMES, indices[0])
        ret, first_frame = cap.read()
        bbox = None
        if ret:
            gray = cv2.cvtColor(first_frame, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(60, 60))
            if len(faces) > 0:
                # Use largest face
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                h_margin = int(w * 0.1)
                v_margin = int(h * 0.1)
                H, W, _ = first_frame.shape
                bbox = (
                    max(0, x - h_margin),
                    max(0, y - v_margin),
                    min(W, x + w + h_margin),
                    min(H, y + h + v_margin)
                )
        
        # Read and process frames
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                # If frame read failed, duplicate the previous frame or use zero frame
                if len(frames) > 0:
                    processed_frame = frames[-1]
                else:
                    processed_frame = torch.zeros((3, self.image_size, self.image_size), dtype=torch.float32)
                frames.append(processed_frame)
                continue
                
            # Crop face using bbox or fallback
            if bbox is not None:
                x1, y1, x2, y2 = bbox
                cropped = frame[y1:y2, x1:x2]
                if cropped.size == 0:
                    cropped = self._crop_face(frame)
            else:
                cropped = self._crop_face(frame)
                
            # Convert BGR to RGB
            cropped = cv2.cvtColor(cropped, cv2.COLOR_BGR2RGB)
            
            # Resize
            cropped = cv2.resize(cropped, (self.image_size, self.image_size))
            
            # Normalize to [0, 1]
            cropped_np = cropped.astype(np.float32) / 255.0
            
            # Apply ImageNet normalization (mean, std)
            mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
            std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
            cropped_np = (cropped_np - mean) / std
            
            # HWC -> CHW
            cropped_tensor = torch.from_numpy(np.transpose(cropped_np, (2, 0, 1)))
            frames.append(cropped_tensor)
            
        cap.release()
        
        # Stack frames along temporal dimension: [num_frames, 3, height, width]
        return torch.stack(frames, dim=0)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        clip_id = row[self.clip_id_col]
        video_path = self._get_video_path(clip_id)
        
        if video_path is None or not os.path.exists(video_path):
            # Fallback for missing/deleted files during loading
            frames = torch.zeros((self.num_frames, 3, self.image_size, self.image_size), dtype=torch.float32)
        else:
            try:
                frames = self._load_video_frames(video_path)
            except Exception as e:
                print(f"Error loading video {video_path}: {e}")
                frames = torch.zeros((self.num_frames, 3, self.image_size, self.image_size), dtype=torch.float32)
                
        # Labels: Boredom, Engagement, Confusion, Frustration
        labels = torch.tensor([
            row[self.boredom_col],
            row[self.engagement_col],
            row[self.confusion_col],
            row[self.frustration_col]
        ], dtype=torch.long)
        
        return frames, labels
