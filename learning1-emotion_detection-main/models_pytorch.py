import torch
import torch.nn as nn
import timm

class DAiSEEEfficientNet(nn.Module):
    """
    DAiSEE Learning-Affect Recognition Model.
    
    Architecture details:
    - Backbone: EfficientNet-B2 (features extracted per frame)
    - Temporal pooling: Average pooling across sampled video frames
    - Classification head: Multi-task linear classifier predicting four affective states:
      1. Boredom
      2. Engagement
      3. Confusion
      4. Frustration
    - Output logits shape: [batch_size, 4, 4] representing:
      [batch_size, num_categories, num_intensity_levels]
      where intensity levels are 0 (none), 1 (low), 2 (medium), 3 (high).
    
    This is a major architectural revision from the single-image AffectNet 8-class facial emotion model.
    """
    def __init__(self, pretrained=True, dropout_rate=0.2):
        super().__init__()
        # Load the EfficientNet-B2 backbone as a feature extractor (num_classes=0)
        self.backbone = timm.create_model('efficientnet_b2', pretrained=pretrained, num_classes=0)
        
        # Safely resolve the feature dimension
        self.num_features = getattr(self.backbone, 'num_features', 1408)
        
        self.dropout = nn.Dropout(p=dropout_rate)
        
        # Classification head for the 4 categories, each predicting 4 intensity levels
        # 4 categories * 4 levels = 16 output logits
        self.classifier = nn.Linear(self.num_features, 4 * 4)

    def forward(self, x):
        # x shape: [batch_size, num_frames, channels, height, width]
        batch_size, num_frames, C, H, W = x.size()
        
        # Reshape to combine batch and frame dimensions for the 2D CNN backbone
        # [batch_size * num_frames, channels, height, width]
        x_flat = x.view(batch_size * num_frames, C, H, W)
        
        # Extract features
        # [batch_size * num_frames, num_features]
        features = self.backbone(x_flat)
        
        # Reshape back to separate batch and frame dimensions
        # [batch_size, num_frames, num_features]
        features = features.view(batch_size, num_frames, self.num_features)
        
        # Temporal aggregation: average features across all frames (dim=1)
        # [batch_size, num_features]
        pooled_features = torch.mean(features, dim=1)
        
        # Apply dropout
        pooled_features = self.dropout(pooled_features)
        
        # Predict logits
        # [batch_size, 16]
        logits = self.classifier(pooled_features)
        
        # Reshape to [batch_size, 4, 4] representing:
        # [batch_size, num_categories (boredom, engagement, confusion, frustration), num_intensity_levels (0,1,2,3)]
        logits = logits.view(batch_size, 4, 4)
        
        return logits

if __name__ == "__main__":
    # Test model shape consistency
    dummy_input = torch.randn(2, 8, 3, 224, 224)
    model = DAiSEEEfficientNet(pretrained=False)
    output = model(dummy_input)
    print("Input shape: ", dummy_input.shape)
    print("Output shape (expected [2, 4, 4]): ", output.shape)
