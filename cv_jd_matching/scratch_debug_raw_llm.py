import os
import sys
from dotenv import load_dotenv

# Load env
load_dotenv(".env")
load_dotenv("../backend/.env")

from llm_client import call_llm
from semantic_matcher import _SYSTEM, build_semantic_match_prompt

cv = """Mô tả công việc 1. Thiết kế và xây dựng các microservices đảm nhiệm các chức năng: giao tiếp với cơ sở dữ liệu, WebSocket, Message Queue, Search Engine. 2. Triển khai hệ thống backend lên server với quy trình CI/CD. 3. Đảm bảo tính ổn định và hiệu suất của hệ thống. 4.Thiết kế và phát triển giao diện người dùng cho website bằng ReactJS. 5. Kết hợp với backend để xây dựng hệ thống hiệu quả, tối ưu. 6. Đảm bảo giao diện thân thiện, responsive trên nhiều thiết bị. Yêu cầu ứng viên 1. Thành thạo ASP.Net Core (C#). 2. Có kinh nghiệm làm việc với PostgreSQL, SQL Server, ElasticSearch. 3. Hiểu biết về Docker, CI/CD là một lợi thế. 4. Tư duy logic, có khả năng giải quyết vấn đề tốt. 5. Thành thạo ReactJS, JavaScript, HTML, CSS. 6. Có kinh nghiệm làm việc với REST API. 7. Hiểu biết cơ bản về Git, Redux là một lợi thế."""

jd = """Requirements Degree in Computer Science, Engineering, or related field 35+ years of relevant experience in full stack and cloud development Core Technical Skills: Strong full stack experience: o Frontend: React / Angular / Vue o Backend: Node.js / Python / Java / PHP Experience with AWS cloud-native architecture API development experience (REST + GraphQL) Strong proficiency in PHP 7/8 Experience with PHP frameworks such as Laravel, CodeIgniter, Symfony, or similar Solid understanding of HTML, CSS, JavaScript Experience with relational databases such as MySQL / PostgreSQL Knowledge of version control systems (e.g. Git) Familiarity with REST APIs and MVC architecture Understanding of secure coding practices Strong problem-solving and debugging skills Experience with Laravel ecosystem (Eloquent, Blade, Artisan) Totara / LMS Experience Experience working with Totara LMS or Moodle-based platforms Hands-on experience with: o GraphQL APIs o LMS customisation (plugins, themes, workflows) Understanding of LMS concepts: o Learning paths, certifications, compliance tracking Note: Totara uses a GraphQL-based API model with extensibility for custom services, making API-driven integration a core competency DevOps & Engineering Practices CI/CD pipelines and Git workflows Infrastructure as Code (CloudFormation / Terraform) Containerisation (Docker, Kubernetes preferred) Secure coding and DevSecOps practices Nice to Have: Experience with: Amazon Connect / AI-driven platforms (for digital concierge use cases) Data analytics (QuickSight, Redshift) Event-driven architectures Exposure to: Multi-tenant SaaS architectures Enterprise integration tools (e.g., Workato) Soft Skills Strong problem-solving and analytical thinking Ability to work in cross-functional teams (EA, DevOps, Business) Clear communication with both technical and non-technical stakeholders What Success Looks Like Successfully deliver scalable AWS-based applications Seamlessly integrate and extend Totara LMS Maintain high system reliability, security, and performance Contribute to enterprise architecture and platform evolution"""

prompt = build_semantic_match_prompt(cv, jd)

try:
    raw = call_llm(_SYSTEM, prompt, max_tokens=4096, temperature=0.15)
    print("--- RAW LLM RESPONSE ---")
    print(raw)
    print("------------------------")
except Exception as e:
    print("Error:", e)
