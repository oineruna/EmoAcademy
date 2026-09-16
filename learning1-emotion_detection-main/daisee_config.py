import os

# Centralized configuration for the DAiSEE learning-affect recognition model training and inference.
# Parameters can be overridden using environment variables if necessary.

# Dataset Paths
DATASET_DIR = os.environ.get("DAISEE_DIR", "./DAiSEE")

# Path to the label CSVs (default layout expects a Labels folder inside DATASET_DIR,
# or CSV files placed directly in the dataset directory).
TRAIN_CSV = os.environ.get("DAISEE_TRAIN_CSV", os.path.join(DATASET_DIR, "Labels", "TrainLabels.csv"))
VAL_CSV = os.environ.get("DAISEE_VAL_CSV", os.path.join(DATASET_DIR, "Labels", "ValidationLabels.csv"))
TEST_CSV = os.environ.get("DAISEE_TEST_CSV", os.path.join(DATASET_DIR, "Labels", "TestLabels.csv"))

# Training & Loader Settings
NUM_FRAMES = int(os.environ.get("DAISEE_NUM_FRAMES", "16"))
IMAGE_SIZE = int(os.environ.get("DAISEE_IMAGE_SIZE", "224"))  # 224 or 288 for EfficientNet-B2

# DAiSEE Affect Categories and Levels
# The 4 target categories: Boredom, Engagement, Confusion, Frustration
NUM_CATEGORIES = 4
CATEGORIES = ["boredom", "engagement", "confusion", "frustration"]

# Each category has 4 intensity levels: 0 (Very Low/None), 1 (Low), 2 (Medium), 3 (High)
NUM_CLASSES = 4
INTENSITY_LEVELS = [0, 1, 2, 3]

# Hyperparameters
BATCH_SIZE = int(os.environ.get("DAISEE_BATCH_SIZE", "8"))
LEARNING_RATE = float(os.environ.get("DAISEE_LEARNING_RATE", "1e-4"))
EPOCHS = int(os.environ.get("DAISEE_EPOCHS", "10"))
DEVICE = os.environ.get("DAISEE_DEVICE", "cuda")  # Auto-resolved in training/inference script

# Paths for Checkpoints
MODEL_PATH = os.environ.get("DAISEE_MODEL_PATH", "./daisee_efficientnet_b2.pt")
PRETRAINED_CHECKPOINT = os.environ.get("PRETRAINED_CHECKPOINT", "./enet_b0_8_va_mtl.pt")
