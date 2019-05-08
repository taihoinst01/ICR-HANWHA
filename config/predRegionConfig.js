/* json structure
 'docType': { 
    'columnSeq': {
        '�»�ܱ���(LU)' : {
            'label(L)': { ���: 0, ����: 0, �ϴ�: 0, ����: 0 },
            'entry(E)': { ���: 0, ����: 0, �ϴ�: 0, ����: 0 }
        },
        '���ϴܱ���(RD)' : {
            'label(L)': { ���: 0, ����: 0, �ϴ�: 0, ����: 0 },
            'entry(E)': { ���: 0, ����: 0, �ϴ�: 0, ����: 0 }
        }
     }
  },
  'default': { // ���ǿ� �����ϴ� ���� ������
        '�»�ܱ���(LU)' : {
            'label(L)': { ���: 0, ����: 0, �ϴ�: 0, ����: 0 },
            'entry(E)': { ���: 0, ����: 0, �ϴ�: 0, ����: 0 }
        },
        '���ϴܱ���(RD)' : {
            'label(L)': { ���: 0, ����: 0, �ϴ�: 0, ����: 0 },
            'entry(E)': { ���: 0, ����: 0, �ϴ�: 0, ����: 0 }
        }
     }
 */

var config = {
    '133': {
        '765': {
            'LU': {
                'L': { up: 0, right: 0, down: 0, left: 0 },
                'E': { up: 0, right: 0, down: 0, left: 0 }
            },
            'RD': {
                'L': { up: 0, right: 0, down: 0, left: 0 },
                'E': { up: 0, right: 0, down: 0, left: 0 }
            }            
        }
    },
    '143': {
        '760': {
            'LU': {
                'L': { up: 0, right: 0, down: 0, left: 0 },
                'E': { up: 5, right: 5, down: 5, left: 5 }
            },
            'RD': {
                'L': { up: 0, right: 0, down: 0, left: 0 },
                'E': { up: 5, right: 5, down: 5, left: 5 }
            }
        },
        '769': {
            'LU': {
                'L': { up: 0, right: 0, down: 0, left: 0 },
                'E': { up: 5, right: 5, down: 5, left: 5 }
            },
            'RD': {
                'L': { up: 0, right: 0, down: 0, left: 0 },
                'E': { up: 5, right: 5, down: 5, left: 5 }
            }
        }
    },
    'default': {
        'LU': {
            'L': { up: 0, right: 0, down: 0, left: 0 },
            'E': { up: 9, right: 9, down: 9, left: 9 }
        },
        'RD': {
            'L': { up: 0, right: 0, down: 0, left: 0 },
            'E': { up: 9, right: 9, down: 9, left: 9 }
        }
    }
};


module.exports = config;

