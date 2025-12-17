
// diff-match-patch v1.0.5
// https://github.com/google/diff-match-patch

(function(self) {
  var DIFF_DELETE = -1, DIFF_INSERT = 0, DIFF_EQUAL = 1;
  
  function diff_match_patch() {}
  
  diff_match_patch.prototype.diff_main = function(text1, text2, opt_checklines, opt_deadline) {
    if (text1 == null || text2 == null) return [[DIFF_EQUAL, '']];
    
    var checklines = opt_checklines !== false;
    var deadline;
    if (typeof opt_deadline == 'number') deadline = opt_deadline;
    else if (opt_deadline) deadline = Date.now() + 1000;
    
    if (text1 == text2) return [[DIFF_EQUAL, text1]];
    
    var commonlength = this.diff_commonPrefix(text1, text2);
    var commonprefix = text1.substring(0, commonlength);
    text1 = text1.substring(commonlength);
    text2 = text2.substring(commonlength);
    
    commonlength = this.diff_commonSuffix(text1, text2);
    var commonsuffix = text1.substring(text1.length - commonlength);
    text1 = text1.substring(0, text1.length - commonlength);
    text2 = text2.substring(0, text2.length - commonlength);
    
    var diffs = this.diff_compute_(text1, text2, checklines, deadline);
    
    if (commonprefix) diffs.unshift([DIFF_EQUAL, commonprefix]);
    if (commonsuffix) diffs.push([DIFF_EQUAL, commonsuffix]);
    this.diff_cleanupMerge(diffs);
    return diffs;
  };
  
  diff_match_patch.prototype.diff_commonPrefix = function(text1, text2) {
    var n = Math.min(text1.length, text2.length);
    for (var i = 0; i < n; i++) if (text1[i] != text2[i]) return i;
    return n;
  };
  
  diff_match_patch.prototype.diff_commonSuffix = function(text1, text2) {
    var n = Math.min(text1.length, text2.length);
    for (var i = 1; i <= n; i++) if (text1[text1.length - i] != text2[text2.length - i]) return i - 1;
    return n;
  };
  
  diff_match_patch.prototype.diff_compute_ = function(text1, text2, checklines, deadline) {
    var diffs = [];
    if (!text1) return [[DIFF_INSERT, text2]];
    if (!text2) return [[DIFF_DELETE, text1]];
    
    var longtext = text1.length > text2.length ? text1 : text2;
    var shorttext = text1.length > text2.length ? text2 : text1;
    var i = longtext.indexOf(shorttext);
    if (i != -1) {
      diffs.push([DIFF_INSERT, longtext.substring(0, i)]);
      diffs.push([DIFF_EQUAL, shorttext]);
      diffs.push([DIFF_INSERT, longtext.substring(i + shorttext.length)]);
      return text1.length > text2.length ? diffs : [[DIFF_DELETE, text1]];
    }
    
    if (shorttext.length == 1) return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
    
    return this.diff_bisect_(text1, text2, deadline);
  };
  
  diff_match_patch.prototype.diff_bisect_ = function(text1, text2, deadline) {
    var max_d = Math.ceil((text1.length + text2.length) / 2);
    var v_offset = max_d, v_length = 2 * max_d;
    var v1 = new Array(v_length), v2 = new Array(v_length);
    for (var x = 0; x < v_length; x++) { v1[x] = -1; v2[x] = -1; }
    v1[v_offset + 1] = 0; v2[v_offset + 1] = 0;
    var delta = text1.length - text2.length, front = (delta % 2 != 0);
    var k1start = 0, k1end = 0, k2start = 0, k2end = 0;
    
    for (var d = 0; d < max_d; d++) {
      if (deadline && Date.now() > deadline) break;
      
      for (var k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
        var k1_offset = v_offset + k1;
        var x1 = (k1 == -d || (k1 != d && v1[k1_offset - 1] < v1[k1_offset + 1])) ? v1[k1_offset + 1] : v1[k1_offset - 1] + 1;
        var y1 = x1 - k1;
        while (x1 < text1.length && y1 < text2.length && text1[x1] == text2[y1]) { x1++; y1++; }
        v1[k1_offset] = x1;
        if (x1 > text1.length) { k1end += 2; } else if (y1 > text2.length) { k1start += 2; } else if (front) {
          var k2_offset = v_offset + delta - k1;
          if (k2_offset >= 0 && k2_offset < v_length && v2[k2_offset] != -1) {
            var x2 = text1.length - v2[k2_offset];
            if (x1 >= x2) return this.diff_bisectSplit_(text1, text2, x1, y1, deadline);
          }
        }
      }
      
      for (var k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
        var k2_offset = v_offset + k2;
        var x2 = (k2 == -d || (k2 != d && v2[k2_offset - 1] < v2[k2_offset + 1])) ? v2[k2_offset + 1] : v2[k2_offset - 1] + 1;
        var y2 = x2 - k2;
        while (x2 < text1.length && y2 < text2.length && text1[text1.length - x2 - 1] == text2[text2.length - y2 - 1]) { x2++; y2++; }
        v2[k2_offset] = x2;
        if (x2 > text1.length) { k2end += 2; } else if (y2 > text2.length) { k2start += 2; } else if (!front) {
          var k1_offset = v_offset + delta - k2;
          if (k1_offset >= 0 && k1_offset < v_length && v1[k1_offset] != -1) {
            var x1 = v1[k1_offset], y1 = v_offset + x1 - k1_offset;
            x2 = text1.length - x2;
            if (x1 >= x2) return this.diff_bisectSplit_(text1, text2, x1, y1, deadline);
          }
        }
      }
    }
    return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
  };
  
  diff_match_patch.prototype.diff_bisectSplit_ = function(text1, text2, x, y, deadline) {
    var text1a = text1.substring(0, x), text2a = text2.substring(0, y);
    var text1b = text1.substring(x), text2b = text2.substring(y);
    var diffs = this.diff_main(text1a, text2a, false, deadline);
    var diffsb = this.diff_main(text1b, text2b, false, deadline);
    return diffs.concat(diffsb);
  };
  
  diff_match_patch.prototype.diff_cleanupMerge = function(diffs) {
    diffs.push([DIFF_EQUAL, '']);
    var pointer = 0, count_delete = 0, count_insert = 0, text_delete = '', text_insert = '';
    
    while (pointer < diffs.length) {
      switch (diffs[pointer][0]) {
        case DIFF_INSERT: count_insert++; text_insert += diffs[pointer][1]; pointer++; break;
        case DIFF_DELETE: count_delete++; text_delete += diffs[pointer][1]; pointer++; break;
        case DIFF_EQUAL:
          if (count_delete + count_insert > 1) {
            if (count_delete !== 0 && count_insert !== 0) {
              var common_length = this.diff_commonPrefix(text_insert, text_delete);
              if (common_length !== 0) {
                if (pointer - count_delete - count_insert > 0 && diffs[pointer - count_delete - count_insert - 1][0] == DIFF_EQUAL) {
                  diffs[pointer - count_delete - count_insert - 1][1] += text_insert.substring(0, common_length);
                } else {
                  diffs.splice(0, 0, [DIFF_EQUAL, text_insert.substring(0, common_length)]);
                  pointer++;
                }
                text_insert = text_insert.substring(common_length);
                text_delete = text_delete.substring(common_length);
              }
              common_length = this.diff_commonSuffix(text_insert, text_delete);
              if (common_length !== 0) {
                diffs[pointer][1] = text_insert.substring(text_insert.length - common_length) + diffs[pointer][1];
                text_insert = text_insert.substring(0, text_insert.length - common_length);
                text_delete = text_delete.substring(0, text_delete.length - common_length);
              }
            }
            if (count_delete === 0) {
              diffs.splice(pointer - count_insert, count_insert, [DIFF_INSERT, text_insert]);
            } else if (count_insert === 0) {
              diffs.splice(pointer - count_delete, count_delete, [DIFF_DELETE, text_delete]);
            } else {
              diffs.splice(pointer - count_delete - count_insert, count_delete + count_insert, [DIFF_DELETE, text_delete], [DIFF_INSERT, text_insert]);
            }
            pointer = pointer - count_delete - count_insert + (count_delete ? 1 : 0) + (count_insert ? 1 : 0) + 1;
          } else if (pointer !== 0 && diffs[pointer - 1][0] == DIFF_EQUAL) {
            diffs[pointer - 1][1] += diffs[pointer][1];
            diffs.splice(pointer, 1);
          } else pointer++;
          count_insert = 0; count_delete = 0; text_delete = ''; text_insert = '';
          break;
      }
    }
    if (diffs[diffs.length - 1][1] === '') diffs.pop();
    
    var changes = false, equalities = [];
    var lastequality = null, pointer = 0, length_insertions1 = 0, length_deletions1 = 0, length_insertions2 = 0, length_deletions2 = 0;
    
    while (pointer < diffs.length) {
      if (diffs[pointer][0] == DIFF_EQUAL) {
        equalities.push(pointer);
        length_insertions1 = length_insertions2; length_deletions1 = length_deletions2;
        length_insertions2 = 0; length_deletions2 = 0; lastequality = diffs[pointer][1];
      } else {
        if (diffs[pointer][0] == DIFF_INSERT) length_insertions2 += diffs[pointer][1].length;
        else length_deletions2 += diffs[pointer][1].length;
        if (lastequality && lastequality.length <= Math.max(length_insertions1, length_deletions1) && Math.max(length_insertions2, length_deletions2) <= Math.max(length_insertions1, length_deletions1)) {
          diffs.splice(equalities[equalities.length - 1], 0, [DIFF_DELETE, lastequality]);
          diffs[equalities[equalities.length - 1] + 1][0] = DIFF_INSERT;
          equalities.pop();
          if (equalities.length > 0) equalities.pop();
          pointer = equalities.length > 0 ? equalities[equalities.length - 1] : -1;
          length_insertions1 = 0; length_deletions1 = 0; length_insertions2 = 0; length_deletions2 = 0; lastequality = null;
          changes = true;
        }
      }
      pointer++;
    }
    if (changes) this.diff_cleanupMerge(diffs);
  };
  
  self.diff_match_patch = diff_match_patch;
  self.DIFF_DELETE = DIFF_DELETE;
  self.DIFF_INSERT = DIFF_INSERT;
  self.DIFF_EQUAL = DIFF_EQUAL;
})(this);
