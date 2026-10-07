package local.fxpro.mql5;

import com.intellij.psi.TokenType;
import com.intellij.psi.tree.IElementType;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** File-local lexical declarations; includes and macro expansion are not resolved here. */
final class MqlNameIndex {
  final Set<String> inputs = new HashSet<>(), macros = new HashSet<>();
  private record Token(String text, int start, int end, IElementType type) {}
  MqlNameIndex(CharSequence source) {
    var scanner = new MqlLexer(false);
    scanner.start(source, 0, source.length(), 0);
    List<Token> tokens = new ArrayList<>();
    while (scanner.getTokenType() != null) {
      IElementType type = scanner.getTokenType();
      if (type != TokenType.WHITE_SPACE && type != MqlTokens.LINE_COMMENT && type != MqlTokens.BLOCK_COMMENT)
        tokens.add(new Token(source.subSequence(scanner.getTokenStart(), scanner.getTokenEnd()).toString(), scanner.getTokenStart(), scanner.getTokenEnd(), type));
      scanner.advance();
    }
    for (int i = 0; i < tokens.size(); i++) {
      String word = tokens.get(i).text;
      if (tokens.get(i).type == MqlTokens.DIRECTIVE) {
        if (word.matches("#[ \\t]*define") && i + 1 < tokens.size() && identifier(tokens.get(i + 1).text)) macros.add(tokens.get(i + 1).text);
        int logicalEnd = tokens.get(i).end;
        while (logicalEnd < source.length()) {
          while (logicalEnd < source.length() && source.charAt(logicalEnd) != '\n') logicalEnd++;
          int last = logicalEnd - 1;
          if (last >= 0 && source.charAt(last) == '\r') last--;
          if (last >= 0 && source.charAt(last) == '\\') logicalEnd++;
          else break;
        }
        while (i + 1 < tokens.size() && tokens.get(i + 1).start < logicalEnd) i++;
        continue;
      }
      if (!word.equals("input") && !word.equals("sinput")) continue;
      int at = i + 1;
      if (at >= tokens.size() || tokens.get(at).text.equals("group")) continue;
      // Optional input(name=...) attribute list is separate from the declaration.
      if (tokens.get(at).text.equals("(")) {
        int depth = 0;
        do { String token = tokens.get(at++).text; if (token.equals("(")) depth++; if (token.equals(")")) depth--; }
        while (at < tokens.size() && depth > 0);
      }
      int end = at;
      while (end < tokens.size() && !tokens.get(end).text.equals(";") && !tokens.get(end).text.equals("input") && !tokens.get(end).text.equals("sinput")) end++;
      int first = at, depth = 0;
      for (int j = at; j <= end; j++) {
        String token = j < end ? tokens.get(j).text : ";";
        if (Set.of("(", "[", "{").contains(token)) depth++;
        if (Set.of(")", "]", "}").contains(token)) depth--;
        if (j == end || token.equals(",") && depth == 0) {
          int equals = first;
          while (equals < j && !tokens.get(equals).text.equals("=")) equals++;
          String name = null;
          int words = 0;
          for (int k = first; k < equals; k++) if (identifier(tokens.get(k).text)) { name = tokens.get(k).text; words++; }
          if (name != null && (first != at || words >= 2) && !MqlBuiltins.TYPES.contains(name)) inputs.add(name);
          first = j + 1;
        }
      }
    }
  }
  private boolean identifier(String word) { return word.matches("[\\p{L}_][\\p{L}\\p{N}_]*"); }
}
