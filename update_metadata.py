# -*- coding: utf-8 -*-
import sqlite3
import json

conn = sqlite3.connect('docling.db')
cursor = conn.cursor()

metadata_map = {
    'kca-foundation': {'koreanName': '기본법규', 'icon': 'Landmark', 'keywords': ['정관', '이사회', '조직'], 'priority': 2},
    'kca-hr': {'koreanName': '인사관리', 'icon': 'Briefcase', 'keywords': ['채용', '승진', '평가'], 'priority': 1},
    'kca-employment': {'koreanName': '고용형태', 'icon': 'Users', 'keywords': ['계약직', '공무직', '전환'], 'priority': 2},
    'kca-attendance': {'koreanName': '복무관리', 'icon': 'Calendar', 'keywords': ['휴가', '재택', '출장'], 'priority': 1},
    'kca-compensation': {'koreanName': '보수급여', 'icon': 'Wallet', 'keywords': ['급여', '수당', '여비'], 'priority': 1},
    'kca-welfare': {'koreanName': '복리후생', 'icon': 'Gift', 'keywords': ['복지', '연금', '사택'], 'priority': 2},
    'kca-discipline': {'koreanName': '징계소송', 'icon': 'Scale', 'keywords': ['징계', '소송', '범죄'], 'priority': 3},
    'kca-ethics': {'koreanName': '윤리청렴', 'icon': 'Shield', 'keywords': ['행동강령', '부패', '이해충돌'], 'priority': 2},
    'kca-finance': {'koreanName': '재무회계', 'icon': 'CreditCard', 'keywords': ['예산', '계약', '카드'], 'priority': 2},
    'kca-audit': {'koreanName': '감사통제', 'icon': 'Search', 'keywords': ['감사', '통제', '적극행정'], 'priority': 3},
    'kca-document': {'koreanName': '문서정보', 'icon': 'FileText', 'keywords': ['문서', '정보공개', '개인정보'], 'priority': 2},
    'kca-certification': {'koreanName': '자격검정', 'icon': 'Award', 'keywords': ['자격검정', '시험'], 'priority': 3},
    'kca-research': {'koreanName': '연구사업', 'icon': 'FlaskConical', 'keywords': ['연구비', '과제', 'R&D'], 'priority': 3},
    'kca-facilities': {'koreanName': '시설장비', 'icon': 'Building', 'keywords': ['장비', '시설', '대여'], 'priority': 3},
}

for name, meta in metadata_map.items():
    desc = json.dumps(meta, ensure_ascii=False)
    cursor.execute('UPDATE qdrant_collections SET description = ? WHERE collection_name = ?', (desc, name))
    print(f'Updated {name}')

conn.commit()
conn.close()
print('Done!')
