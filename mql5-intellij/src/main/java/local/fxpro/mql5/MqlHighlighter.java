package local.fxpro.mql5;

import com.intellij.lexer.Lexer;
import com.intellij.openapi.editor.DefaultLanguageHighlighterColors;
import com.intellij.openapi.editor.HighlighterColors;
import com.intellij.openapi.editor.colors.TextAttributesKey;
import com.intellij.openapi.fileTypes.SyntaxHighlighterBase;
import com.intellij.psi.TokenType;
import com.intellij.psi.tree.IElementType;
import java.util.Map;
import static com.intellij.openapi.editor.colors.TextAttributesKey.createTextAttributesKey;
import static local.fxpro.mql5.MqlTokens.*;

public final class MqlHighlighter extends SyntaxHighlighterBase {
  public static final TextAttributesKey KEYWORD_COLOR = createTextAttributesKey("MQL5.KEYWORD", DefaultLanguageHighlighterColors.KEYWORD);
  // Class names can use plain text in Light. Types need a visible language color.
  public static final TextAttributesKey TYPE_COLOR = createTextAttributesKey("MQL5.TYPE", DefaultLanguageHighlighterColors.KEYWORD);
  public static final TextAttributesKey FUNCTION_COLOR = createTextAttributesKey("MQL5.FUNCTION", DefaultLanguageHighlighterColors.FUNCTION_CALL);
  public static final TextAttributesKey CONSTANT_COLOR = createTextAttributesKey("MQL5.CONSTANT", DefaultLanguageHighlighterColors.CONSTANT);
  public static final TextAttributesKey BUILTIN_FUNCTION_COLOR = createTextAttributesKey("MQL5.BUILTIN_FUNCTION", DefaultLanguageHighlighterColors.KEYWORD);
  public static final TextAttributesKey ENTRY_POINT_COLOR = createTextAttributesKey("MQL5.ENTRY_POINT", DefaultLanguageHighlighterColors.KEYWORD);
  public static final TextAttributesKey INPUT_VARIABLE_COLOR = createTextAttributesKey("MQL5.INPUT_VARIABLE", DefaultLanguageHighlighterColors.STRING);
  public static final TextAttributesKey MACRO_COLOR = createTextAttributesKey("MQL5.MACRO", DefaultLanguageHighlighterColors.KEYWORD);
  public static final TextAttributesKey INDICATOR_COLOR = createTextAttributesKey("MQL5.INDICATOR", DefaultLanguageHighlighterColors.KEYWORD);
  public static final TextAttributesKey PREDEFINED_COLOR = createTextAttributesKey("MQL5.PREDEFINED", DefaultLanguageHighlighterColors.KEYWORD);
  public static final TextAttributesKey NUMBER_COLOR = createTextAttributesKey("MQL5.NUMBER", DefaultLanguageHighlighterColors.NUMBER);
  public static final TextAttributesKey STRING_COLOR = createTextAttributesKey("MQL5.STRING", DefaultLanguageHighlighterColors.STRING);
  public static final TextAttributesKey LINE_COMMENT_COLOR = createTextAttributesKey("MQL5.LINE_COMMENT", DefaultLanguageHighlighterColors.LINE_COMMENT);
  public static final TextAttributesKey BLOCK_COMMENT_COLOR = createTextAttributesKey("MQL5.BLOCK_COMMENT", DefaultLanguageHighlighterColors.BLOCK_COMMENT);
  public static final TextAttributesKey DIRECTIVE_COLOR = createTextAttributesKey("MQL5.DIRECTIVE", DefaultLanguageHighlighterColors.METADATA);
  public static final TextAttributesKey OPERATOR_COLOR = createTextAttributesKey("MQL5.OPERATOR", DefaultLanguageHighlighterColors.OPERATION_SIGN);
  public static final TextAttributesKey BRACE_COLOR = createTextAttributesKey("MQL5.BRACES", DefaultLanguageHighlighterColors.BRACES);
  public static final TextAttributesKey PAREN_COLOR = createTextAttributesKey("MQL5.PARENTHESES", DefaultLanguageHighlighterColors.PARENTHESES);
  public static final TextAttributesKey BRACKET_COLOR = createTextAttributesKey("MQL5.BRACKETS", DefaultLanguageHighlighterColors.BRACKETS);
  public static final TextAttributesKey PUNCTUATION_COLOR = createTextAttributesKey("MQL5.PUNCTUATION", DefaultLanguageHighlighterColors.SEMICOLON);
  private static final Map<IElementType, TextAttributesKey> COLORS = Map.ofEntries(
      Map.entry(KEYWORD, KEYWORD_COLOR), Map.entry(TYPE, TYPE_COLOR), Map.entry(FUNCTION, FUNCTION_COLOR),
      Map.entry(CONSTANT, CONSTANT_COLOR), Map.entry(NUMBER, NUMBER_COLOR), Map.entry(STRING, STRING_COLOR),
      Map.entry(BUILTIN_FUNCTION, BUILTIN_FUNCTION_COLOR), Map.entry(ENTRY_POINT, ENTRY_POINT_COLOR),
      Map.entry(INPUT_VARIABLE, INPUT_VARIABLE_COLOR), Map.entry(MACRO, MACRO_COLOR),
      Map.entry(INDICATOR, INDICATOR_COLOR), Map.entry(PREDEFINED, PREDEFINED_COLOR),
      Map.entry(CHARACTER, STRING_COLOR), Map.entry(DATE, NUMBER_COLOR), Map.entry(COLOR, NUMBER_COLOR),
      Map.entry(DIRECTIVE, DIRECTIVE_COLOR), Map.entry(LINE_COMMENT, LINE_COMMENT_COLOR), Map.entry(BLOCK_COMMENT, BLOCK_COMMENT_COLOR),
      Map.entry(OPERATOR, OPERATOR_COLOR), Map.entry(LEFT_BRACE, BRACE_COLOR), Map.entry(RIGHT_BRACE, BRACE_COLOR),
      Map.entry(LEFT_PAREN, PAREN_COLOR), Map.entry(RIGHT_PAREN, PAREN_COLOR), Map.entry(LEFT_BRACKET, BRACKET_COLOR),
      Map.entry(RIGHT_BRACKET, BRACKET_COLOR), Map.entry(PUNCTUATION, PUNCTUATION_COLOR),
      Map.entry(TokenType.BAD_CHARACTER, HighlighterColors.BAD_CHARACTER));
  @Override public Lexer getHighlightingLexer() { return new MqlLexer(); }
  @Override public TextAttributesKey[] getTokenHighlights(IElementType tokenType) {
    TextAttributesKey key = COLORS.get(tokenType);
    return key == null ? TextAttributesKey.EMPTY_ARRAY : new TextAttributesKey[]{key};
  }
}
