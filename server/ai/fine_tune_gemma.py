import os
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from datasets import load_dataset

# Configuration
MODEL_ID = "google/gemma-4-e2b-it"
DATASET_ID = "flan-medical-qa-subset" # Example medical dataset
OUTPUT_DIR = "./gemma-health-edge-weights"

# 1. Load Model with 4-bit Quantization (QLoRA)
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True
)

# 2. Prepare for Training
model = prepare_model_for_kbit_training(model)

lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "o_proj", "k_proj", "v_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)

# 3. Load and Preprocess Data
# In a real scenario, you would load your custom medical dataset here
dataset = load_dataset("json", data_files="medical_instructions.jsonl", split="train")

def tokenize_function(examples):
    return tokenizer(examples["text"], padding="max_length", truncation=True, max_length=512)

tokenized_dataset = dataset.map(tokenize_function, batched=True)

# 4. Training Loop (Simplified for Script)
# Use TrainingArguments and SFTTrainer for the full implementation
print("Model ready for fine-tuning with LoRA.")
print(f"Trainable parameters: {model.print_trainable_parameters()}")

# After training, save the adapters
# model.save_pretrained(OUTPUT_DIR)
# tokenizer.save_pretrained(OUTPUT_DIR)

print(f"Run this script on Kaggle/Colab with a GPU (T4/L4) to generate weights for {MODEL_ID}")
