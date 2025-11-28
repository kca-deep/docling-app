import pandas as pd
import json
from pathlib import Path
import sys

# UTF-8 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')

# 파일 경로
fund_regu_path = r"D:\workspace\docling-app\docs\fund_regu.xlsx"
faq_topic_path = r"D:\workspace\docling-app\docs\faq_topic.xlsx"

print("=" * 80)
print("1. fund_regu.xlsx 분석")
print("=" * 80)

try:
    # fund_regu.xlsx 읽기
    xl_file = pd.ExcelFile(fund_regu_path)
    print(f"시트 목록: {xl_file.sheet_names}")
    print()

    for sheet_name in xl_file.sheet_names:
        print(f"[시트: {sheet_name}]")
        df = pd.read_excel(fund_regu_path, sheet_name=sheet_name)
        print(f"  - 행 수: {len(df)}")
        print(f"  - 열 수: {len(df.columns)}")
        print(f"  - 컬럼명: {list(df.columns)}")
        print(f"  - 샘플 데이터 (상위 3행):")
        print(df.head(3).to_string(index=False))
        print()

        # 데이터 타입 분석
        print(f"  - 데이터 타입:")
        for col in df.columns:
            non_null = df[col].notna().sum()
            unique = df[col].nunique()
            print(f"    * {col}: {df[col].dtype} (non-null: {non_null}, unique: {unique})")
        print()

except Exception as e:
    print(f"fund_regu.xlsx 읽기 오류: {e}")

print("=" * 80)
print("2. faq_topic.xlsx 분석")
print("=" * 80)

try:
    # faq_topic.xlsx 읽기
    xl_file = pd.ExcelFile(faq_topic_path)
    print(f"시트 목록: {xl_file.sheet_names}")
    print()

    for sheet_name in xl_file.sheet_names:
        print(f"[시트: {sheet_name}]")
        df = pd.read_excel(faq_topic_path, sheet_name=sheet_name)
        print(f"  - 행 수: {len(df)}")
        print(f"  - 열 수: {len(df.columns)}")
        print(f"  - 컬럼명: {list(df.columns)}")
        print(f"  - 샘플 데이터 (상위 3행):")
        print(df.head(3).to_string(index=False))
        print()

        # 데이터 타입 분석
        print(f"  - 데이터 타입:")
        for col in df.columns:
            non_null = df[col].notna().sum()
            unique = df[col].nunique()
            print(f"    * {col}: {df[col].dtype} (non-null: {non_null}, unique: {unique})")
        print()

        # 텍스트 길이 분석 (문자열 컬럼만)
        text_cols = df.select_dtypes(include=['object']).columns
        if len(text_cols) > 0:
            print(f"  - 텍스트 컬럼 길이 분석:")
            for col in text_cols:
                if df[col].notna().any():
                    lengths = df[col].dropna().astype(str).str.len()
                    print(f"    * {col}: 평균 {lengths.mean():.1f}자, 최소 {lengths.min()}자, 최대 {lengths.max()}자")
        print()

except Exception as e:
    print(f"faq_topic.xlsx 읽기 오류: {e}")

print("=" * 80)
print("3. RAG 구성을 위한 데이터 특성 요약")
print("=" * 80)

# 통계 정보 요약
try:
    # fund_regu 요약
    df_fund = pd.read_excel(fund_regu_path)
    print(f"fund_regu.xlsx:")
    print(f"  - 총 문서 수: {len(df_fund)}")
    if '내용' in df_fund.columns or 'content' in df_fund.columns:
        content_col = '내용' if '내용' in df_fund.columns else 'content'
        avg_len = df_fund[content_col].dropna().astype(str).str.len().mean()
        print(f"  - 평균 문서 길이: {avg_len:.0f}자")

    # faq_topic 요약
    df_faq = pd.read_excel(faq_topic_path)
    print(f"\nfaq_topic.xlsx:")
    print(f"  - 총 FAQ 수: {len(df_faq)}")
    if 'question' in df_faq.columns or '질문' in df_faq.columns:
        q_col = 'question' if 'question' in df_faq.columns else '질문'
        avg_q_len = df_faq[q_col].dropna().astype(str).str.len().mean()
        print(f"  - 평균 질문 길이: {avg_q_len:.0f}자")
    if 'answer' in df_faq.columns or '답변' in df_faq.columns:
        a_col = 'answer' if 'answer' in df_faq.columns else '답변'
        avg_a_len = df_faq[a_col].dropna().astype(str).str.len().mean()
        print(f"  - 평균 답변 길이: {avg_a_len:.0f}자")

except Exception as e:
    print(f"요약 분석 오류: {e}")