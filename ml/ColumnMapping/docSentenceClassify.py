import sys
# import os
# import subprocess
# import PIL.Image as Image
# import http.client, urllib.request, urllib.parse, urllib.error, base64
import base64
import json
# # import operator
# import timeit
import re
# import math
# import cv2
# import numpy as np
# from glob import glob
# from difflib import SequenceMatcher
# from pdf2image import convert_from_path, convert_from_bytes

def insertDocSentence(str):

    print(str)
    # file = open('./ml/ColumnMapping/docSentence1.txt', 'a')
    # fileName = "C:/Users/taiho/source/repos/taihoinst01/ICR-DAERIM/ml/ColumnMapping/docSentence.txt"
    # file = open(fileName, "a", encoding="utf-8")
    file = open("./ml/ColumnMapping/docSentence.txt", "a", -1, encoding="UTF8")
    file.write("\n%s" % base64ToString(str))
    file.close()

    return "ok"

def stringToBase64(s):
    return base64.b64encode(s.encode('utf-8'))

def base64ToString(b):
    return base64.b64decode(b).decode('utf-8')


if __name__ == '__main__':
    try:
        retResult = []
        data = sys.argv[1]
        # data = "曇,1174,레디 리스트 콘크리트,납품서,다듬니,사 曰 자,0표 준 명  레디믹스트 콘크리트,1328113908,등록번호,0표 준 번 호  KS F 4009,주식회A十 산0,0인 증 번 호,O 사,제 9603026호,0인 증 기 관 • 한국표준협회,대표이사 전 찬 7,급 성 명,0인 증 종 류,보통포장고강도 콘크리트,20 18년 11 월 08 일||131||58"
        obj = insertDocSentence(data)
        retResult.append(data)

        result = re.sub('None', "null", json.dumps(retResult, ensure_ascii=False))
        print(base64.b64encode(result.encode('utf-8')))

    except Exception as e:
        print(e)


