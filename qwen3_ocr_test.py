#!/usr/bin/env python3
"""
Qwen3 VL 8B OCR 테스트 스크립트
PDF를 이미지로 변환하고 8084 포트의 Qwen3 VL 8B 모델로 OCR 수행
"""
import os
import base64
import requests
import json
import fitz  # PyMuPDF
from PIL import Image
import io
import time

# 설정
PDF_PATH = "/home/kca/1. (시행일정) 2025년도 국가자격 검정시행안내.pdf"
API_URL = "http://localhost:8084/v1/chat/completions"
OUTPUT_DIR = "/home/kca/qwen3_ocr_results"
MAX_PAGES = 8  # 최대 처리할 페이지 수

# 출력 디렉토리 생성
os.makedirs(OUTPUT_DIR, exist_ok=True)

def image_to_base64(image):
    """PIL Image를 base64 문자열로 변환"""
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode('utf-8')

def perform_ocr(image_base64, page_num):
    """Qwen3 VL 8B 모델로 OCR 수행"""
    headers = {
        "Content-Type": "application/json"
    }

    payload = {
        "model": "qwen3-vl-8b",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image_base64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": "이미지에 있는 모든 텍스트를 정확하게 추출해주세요. 표, 날짜, 숫자 등 모든 내용을 원본 형식 그대로 보존하여 추출해주세요. Extract all text from this image accurately, preserving tables, dates, numbers, and formatting."
                    }
                ]
            }
        ],
        "max_tokens": 4096,
        "temperature": 0.1
    }

    try:
        print(f"페이지 {page_num} OCR 요청 중...")
        response = requests.post(API_URL, headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        result = response.json()

        if 'choices' in result and len(result['choices']) > 0:
            ocr_text = result['choices'][0]['message']['content']
            return ocr_text
        else:
            return f"오류: 응답에서 텍스트를 찾을 수 없습니다. 응답: {result}"

    except Exception as e:
        return f"오류 발생: {str(e)}"

def pdf_to_images(pdf_path):
    """PyMuPDF를 사용하여 PDF를 PIL Image 리스트로 변환"""
    images = []
    pdf_document = fitz.open(pdf_path)

    for page_num in range(pdf_document.page_count):
        page = pdf_document[page_num]
        # 200 DPI로 렌더링 (zoom factor = 200/72)
        mat = fitz.Matrix(2.78, 2.78)
        pix = page.get_pixmap(matrix=mat)

        # PIL Image로 변환
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        images.append(img)

    pdf_document.close()
    return images

def main():
    print(f"PDF 파일 처리 시작: {PDF_PATH}")
    print(f"API URL: {API_URL}")
    print(f"출력 디렉토리: {OUTPUT_DIR}\n")

    # PDF를 이미지로 변환
    print("PDF를 이미지로 변환 중...")
    try:
        images = pdf_to_images(PDF_PATH)
        print(f"총 {len(images)}페이지 변환 완료\n")
    except Exception as e:
        print(f"PDF 변환 오류: {e}")
        import traceback
        traceback.print_exc()
        return

    # 각 페이지 처리
    total_pages = min(len(images), MAX_PAGES)
    results = []

    for i, image in enumerate(images[:total_pages], 1):
        print(f"\n{'='*60}")
        print(f"페이지 {i}/{total_pages} 처리 중")
        print(f"{'='*60}")

        # 이미지 저장
        image_path = os.path.join(OUTPUT_DIR, f"page_{i}.png")
        image.save(image_path)
        print(f"이미지 저장: {image_path}")

        # 이미지를 base64로 변환
        image_base64 = image_to_base64(image)

        # OCR 수행
        start_time = time.time()
        ocr_result = perform_ocr(image_base64, i)
        elapsed_time = time.time() - start_time

        print(f"OCR 완료 (소요 시간: {elapsed_time:.2f}초)")
        print(f"\n--- OCR 결과 (페이지 {i}) ---")
        print(ocr_result[:500] + "..." if len(ocr_result) > 500 else ocr_result)
        print(f"--- 결과 끝 ---\n")

        # 결과 저장
        result_path = os.path.join(OUTPUT_DIR, f"page_{i}_ocr.txt")
        with open(result_path, 'w', encoding='utf-8') as f:
            f.write(f"페이지 {i} OCR 결과\n")
            f.write(f"소요 시간: {elapsed_time:.2f}초\n")
            f.write("="*60 + "\n\n")
            f.write(ocr_result)

        results.append({
            'page': i,
            'ocr_result': ocr_result,
            'elapsed_time': elapsed_time,
            'image_path': image_path,
            'result_path': result_path
        })

        # API 부하 방지를 위한 짧은 대기
        if i < total_pages:
            time.sleep(1)

    # 전체 결과 요약 저장
    summary_path = os.path.join(OUTPUT_DIR, "summary.json")
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump({
            'pdf_path': PDF_PATH,
            'total_pages': len(images),
            'processed_pages': len(results),
            'results': results
        }, f, ensure_ascii=False, indent=2)

    # 통합 OCR 결과 저장
    combined_path = os.path.join(OUTPUT_DIR, "all_pages_ocr.txt")
    with open(combined_path, 'w', encoding='utf-8') as f:
        f.write("Qwen3 VL 8B OCR 전체 결과\n")
        f.write(f"PDF: {PDF_PATH}\n")
        f.write(f"총 페이지: {len(images)}, 처리된 페이지: {len(results)}\n")
        f.write("="*80 + "\n\n")

        for result in results:
            f.write(f"\n{'='*80}\n")
            f.write(f"페이지 {result['page']}\n")
            f.write(f"소요 시간: {result['elapsed_time']:.2f}초\n")
            f.write(f"{'='*80}\n\n")
            f.write(result['ocr_result'])
            f.write("\n\n")

    print(f"\n\n{'='*80}")
    print("처리 완료!")
    print(f"{'='*80}")
    print(f"총 처리 페이지: {len(results)}/{len(images)}")
    print(f"총 소요 시간: {sum(r['elapsed_time'] for r in results):.2f}초")
    print(f"평균 소요 시간: {sum(r['elapsed_time'] for r in results) / len(results):.2f}초/페이지")
    print(f"\n결과 파일:")
    print(f"  - 통합 결과: {combined_path}")
    print(f"  - 요약: {summary_path}")
    print(f"  - 개별 결과: {OUTPUT_DIR}/page_*_ocr.txt")

if __name__ == "__main__":
    main()
