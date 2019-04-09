/* json structure
 'docType': { 
    'columnSeq': {
        '좌상단기준(LU)' : {
            'label(L)': { 상단: 0, 우측: 0, 하단: 0, 좌측: 0 },
            'entry(E)': { 상단: 0, 우측: 0, 하단: 0, 좌측: 0 }
        },
        '우하단기준(RD)' : {
            'label(L)': { 상단: 0, 우측: 0, 하단: 0, 좌측: 0 },
            'entry(E)': { 상단: 0, 우측: 0, 하단: 0, 좌측: 0 }
        }
     }
  },
  'default': { // 조건에 만족하는 값이 없으면
        '좌상단기준(LU)' : {
            'label(L)': { 상단: 0, 우측: 0, 하단: 0, 좌측: 0 },
            'entry(E)': { 상단: 0, 우측: 0, 하단: 0, 좌측: 0 }
        },
        '우하단기준(RD)' : {
            'label(L)': { 상단: 0, 우측: 0, 하단: 0, 좌측: 0 },
            'entry(E)': { 상단: 0, 우측: 0, 하단: 0, 좌측: 0 }
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
    'default': {
        'LU': {
            'L': { up: 0, right: 0, down: 0, left: 0 },
            'E': { up: 0, right: 0, down: 0, left: 0 }
        },
        'RD': {
            'L': { up: 0, right: 0, down: 0, left: 0 },
            'E': { up: 0, right: 0, down: 0, left: 0 }
        }
    }
};


module.exports = config;

