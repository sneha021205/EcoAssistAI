"""
EcoAssistAI - Local Ollama Connectivity & Model Verification Script
Used for pre-flight testing and system verification.
"""

import sys
import time
import requests
import json

# Ensure UTF-8 output encoding for Windows terminals
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

OLLAMA_BASE_URL = "http://127.0.0.1:11434"
MODEL_NAME = "qwen2.5:3b-instruct"

def test_ollama_service():
    print("=" * 60)
    print("EcoAssist AI: Pre-flight Verification")
    print("=" * 60)
    
    # 1. Check if Ollama service is reachable
    print(f"[*] Step 1: Testing connection to Ollama at {OLLAMA_BASE_URL}...")
    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if resp.status_code == 200:
            print("[OK] Ollama service is online and responding!")
            models = resp.json().get("models", [])
            model_names = [m.get("name") for m in models]
            print(f"    Available models: {', '.join(model_names) if model_names else 'None'}")
            
            # Check if target model is present
            matching = [name for name in model_names if MODEL_NAME in name]
            if not matching:
                print(f"[!] Warning: Model '{MODEL_NAME}' not found in installed models.")
                print(f"    Please run: ollama pull {MODEL_NAME}")
                return False
            else:
                print(f"[OK] Model '{MODEL_NAME}' is ready for inference!")
        else:
            print(f"[FAIL] Unexpected HTTP status from Ollama: {resp.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("[FAIL] Connection Error: Cannot connect to Ollama.")
        print("    Ensure Ollama is running. Start it by typing 'ollama serve' in your terminal.")
        return False
    except Exception as e:
        print(f"[FAIL] Error contacting Ollama: {e}")
        return False

    # 2. Test prompt generation
    print("\n[*] Step 2: Testing generative inference with Qwen2.5 3B...")
    sample_prompt = "What is a carbon footprint? Answer in two concise, encouraging sentences."
    print(f"    Prompt: \"{sample_prompt}\"")
    
    payload = {
        "model": MODEL_NAME,
        "prompt": sample_prompt,
        "stream": False,
        "options": {
            "temperature": 0.7,
            "num_predict": 100
        }
    }
    
    start_time = time.time()
    try:
        gen_resp = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=30)
        elapsed = time.time() - start_time
        
        if gen_resp.status_code == 200:
            result = gen_resp.json()
            answer = result.get("response", "").strip()
            print(f"\n[OK] Inference Successful! (Completed in {elapsed:.2f} seconds)")
            print("-" * 60)
            print("Response from Qwen2.5:")
            print(answer)
            print("-" * 60)
            return True
        else:
            print(f"[FAIL] Inference failed with status {gen_resp.status_code}: {gen_resp.text}")
            return False
    except Exception as e:
        print(f"[FAIL] Error during inference test: {e}")
        return False

if __name__ == "__main__":
    success = test_ollama_service()
    if success:
        print("\nAll checks passed! EcoAssist AI backend is ready to run.")
    else:
        print("\nVerification incomplete. Please check the steps above.")

