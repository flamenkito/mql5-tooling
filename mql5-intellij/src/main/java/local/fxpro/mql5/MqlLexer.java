package local.fxpro.mql5;

import com.intellij.lexer.LexerBase;
import com.intellij.psi.TokenType;
import com.intellij.psi.tree.IElementType;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import static local.fxpro.mql5.MqlTokens.*;

/** A lossless highlighting lexer. States describe the start of each token. */
public final class MqlLexer extends LexerBase {
  private static final int NORMAL = 0, IN_COMMENT = 1, IN_STRING = 2;
  private static final Set<String> KEYWORDS = Set.of(
      "break", "case", "class", "const", "continue", "default", "delete", "do",
      "dynamic_cast", "else", "enum", "extern", "false", "for", "group", "if", "input",
      "namespace", "new", "offsetof", "operator", "override", "pack", "private", "protected",
      "public", "return", "sinput", "sizeof", "static", "struct", "switch", "template",
      "this", "true", "typename", "union", "virtual", "while");
  private static final Pattern NUMERIC = Pattern.compile(
      "(?:0[xX][0-9a-fA-F]+|(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?)[uUlLfF]*");
  private CharSequence buffer = "";
  private int end, start, finish, nextState, tokenState;
  private IElementType type;
  private final boolean indexNames;
  private CharSequence indexedBuffer;
  private MqlNameIndex names;
  public MqlLexer() { this(true); }
  MqlLexer(boolean indexNames) { this.indexNames = indexNames; }

  @Override public void start(CharSequence text, int startOffset, int endOffset, int initialState) {
    buffer = text;
    if (indexNames && (!(text instanceof String) || indexedBuffer != text)) { names = new MqlNameIndex(text); indexedBuffer = text; }
    end = endOffset;
    finish = startOffset;
    nextState = initialState;
    advance();
  }
  @Override public int getState() { return tokenState; }
  @Override public IElementType getTokenType() { return type; }
  @Override public int getTokenStart() { return start; }
  @Override public int getTokenEnd() { return finish; }
  @Override public CharSequence getBufferSequence() { return buffer; }
  @Override public int getBufferEnd() { return end; }
  private char at(int offset) { return offset < end ? buffer.charAt(offset) : '\0'; }
  private boolean wordStart(char c) { return c == '_' || Character.isLetter(c); }
  private boolean wordPart(char c) { return wordStart(c) || Character.isDigit(c); }

  @Override public void advance() {
    start = finish;
    tokenState = nextState;
    type = null;
    if (start >= end) return;
    if (nextState == IN_COMMENT) { comment(start); return; }
    if (nextState == IN_STRING) { quoted(start, '"', STRING); return; }
    char c = at(start);
    if (Character.isWhitespace(c) || c == '\uFEFF') {
      finish = start + 1;
      while (finish < end && (Character.isWhitespace(at(finish)) || at(finish) == '\uFEFF')) finish++;
      type = TokenType.WHITE_SPACE;
    } else if (c == '/' && at(start + 1) == '/') {
      finish = start + 2;
      while (finish < end && at(finish) != '\n' && at(finish) != '\r') finish++;
      type = LINE_COMMENT;
    } else if (c == '/' && at(start + 1) == '*') {
      comment(start + 2);
    } else if (c == '"' || c == '\'') {
      quoted(start + 1, c, c == '"' ? STRING : CHARACTER);
    } else if ((c == 'D' || c == 'd' || c == 'C' || c == 'c') && at(start + 1) == '\'') {
      quoted(start + 2, '\'', c == 'D' || c == 'd' ? DATE : COLOR);
    } else if (c == '#' && directiveStart()) {
      finish = start + 1;
      while (at(finish) == ' ' || at(finish) == '\t') finish++;
      while (finish < end && wordPart(at(finish))) finish++;
      type = DIRECTIVE;
    } else if (c == '<' && includeArgument()) {
      finish = start + 1;
      while (finish < end && at(finish) != '>' && at(finish) != '\n' && at(finish) != '\r') finish++;
      if (at(finish) == '>') finish++;
      type = STRING;
    } else if (Character.isDigit(c) || (c == '.' && Character.isDigit(at(start + 1)))) {
      Matcher match = NUMERIC.matcher(buffer).region(start, end);
      if (match.lookingAt()) { finish = match.end(); type = NUMBER; }
      else { finish = start + 1; type = TokenType.BAD_CHARACTER; }
    } else if (wordStart(c)) {
      finish = start + 1;
      while (finish < end && wordPart(at(finish))) finish++;
      String word = buffer.subSequence(start, finish).toString();
      int after = finish;
      while (after < end && Character.isWhitespace(at(after))) after++;
      type = KEYWORDS.contains(word) ? KEYWORD
          : names != null && names.macros.contains(word) ? MACRO
          : names != null && names.inputs.contains(word) ? INPUT_VARIABLE
          : MqlBuiltins.TYPES.contains(word) || word.startsWith("ENUM_") ? TYPE
          : MqlBuiltins.PREDEFINED.contains(word) ? PREDEFINED
          : MqlBuiltins.EVENTS.contains(word) ? ENTRY_POINT
          : MqlBuiltins.INDICATORS.contains(word) || indicatorProperty(word) ? INDICATOR
          : MqlBuiltins.FUNCTIONS.contains(word) ? BUILTIN_FUNCTION
          : MqlBuiltins.CONSTANTS.contains(word) || word.matches("[A-Z_][A-Z_0-9]*") ? CONSTANT
          : at(after) == '(' ? FUNCTION : IDENTIFIER;
    } else {
      finish = start + 1;
      type = switch (c) {
        case '{' -> LEFT_BRACE; case '}' -> RIGHT_BRACE;
        case '(' -> LEFT_PAREN; case ')' -> RIGHT_PAREN;
        case '[' -> LEFT_BRACKET; case ']' -> RIGHT_BRACKET;
        case ';', ',' -> PUNCTUATION;
        case '+', '-', '*', '/', '%', '=', '!', '&', '|', '^', '~', '<', '>', '?', ':', '.', '#', '\\' -> OPERATOR;
        default -> TokenType.BAD_CHARACTER;
      };
    }
  }

  private boolean indicatorProperty(String word) {
    if (!word.matches("indicator_(?:chart_window|separate_window|height|buffers|plots|minimum|maximum|levelcolor|levelwidth|levelstyle|(?:label|color|width|style|type|level)[0-9]+)")) return false;
    int line = start;
    while (line > 0 && buffer.charAt(line - 1) != '\n' && buffer.charAt(line - 1) != '\r') line--;
    return buffer.subSequence(line, start).toString().matches("[ \\t\\uFEFF]*#[ \\t]*property[ \\t]+.*");
  }

  private boolean directiveStart() {
    for (int i = start - 1; i >= 0; i--) {
      char c = buffer.charAt(i);
      if (c == '\n' || c == '\r') return true;
      if (c != ' ' && c != '\t' && c != '\uFEFF') return false;
    }
    return true;
  }
  private boolean includeArgument() {
    int line = start;
    while (line > 0 && buffer.charAt(line - 1) != '\n' && buffer.charAt(line - 1) != '\r') line--;
    return buffer.subSequence(line, start).toString().matches("[ \\t]*#[ \\t]*include[ \\t]*");
  }
  private void comment(int offset) {
    type = BLOCK_COMMENT;
    nextState = IN_COMMENT;
    finish = offset;
    while (finish < end) {
      if (at(finish) == '*' && at(finish + 1) == '/') { finish += 2; nextState = NORMAL; return; }
      if (at(finish++) == '\n') return; // Restartable state at the next line.
    }
  }
  private void quoted(int offset, char quote, IElementType literalType) {
    type = literalType;
    finish = offset;
    nextState = NORMAL;
    while (finish < end) {
      char c = at(finish++);
      if (c == quote) return;
      if (c == '\n' || c == '\r') return; // Recover after an unterminated literal.
      if (c == '\\' && finish < end) {
        char escaped = at(finish++);
        if (quote == '"' && (escaped == '\n' || escaped == '\r')) {
          if (escaped == '\r' && at(finish) == '\n') finish++;
          nextState = IN_STRING;
          return;
        }
      }
    }
  }
}
