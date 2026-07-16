import os
import sys
from dotenv import load_dotenv

# Load env
load_dotenv(".env")
load_dotenv("../backend/.env")

from llm_client import call_llm

print("LLM_BASE_URL:", os.environ.get("LLM_BASE_URL"))
print("LLM_API_KEY:", os.environ.get("LLM_API_KEY")[:10] + "..." if os.environ.get("LLM_API_KEY") else None)
print("LLM_MODEL:", os.environ.get("LLM_MODEL"))

sys_prompt = "You are a helpful assistant."
user_prompt = "Say hello in 5 words."

try:
    res = call_llm(sys_prompt, user_prompt)
    print("Response:", res)
except Exception as e:
    print("Error:", e)
