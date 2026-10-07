package local.fxpro.mql5;

import com.intellij.psi.tree.IElementType;

public final class MqlTokens {
  private MqlTokens() {}
  private static IElementType token(String name) { return new IElementType(name, MqlLanguage.INSTANCE); }
  public static final IElementType KEYWORD = token("KEYWORD"), TYPE = token("TYPE"),
      IDENTIFIER = token("IDENTIFIER"), FUNCTION = token("FUNCTION"), CONSTANT = token("CONSTANT"),
      BUILTIN_FUNCTION = token("BUILTIN_FUNCTION"), ENTRY_POINT = token("ENTRY_POINT"),
      INPUT_VARIABLE = token("INPUT_VARIABLE"), MACRO = token("MACRO"), INDICATOR = token("INDICATOR"),
      PREDEFINED = token("PREDEFINED"),
      NUMBER = token("NUMBER"), STRING = token("STRING"), CHARACTER = token("CHARACTER"),
      DATE = token("DATE"), COLOR = token("COLOR"), DIRECTIVE = token("DIRECTIVE"),
      LINE_COMMENT = token("LINE_COMMENT"), BLOCK_COMMENT = token("BLOCK_COMMENT"),
      OPERATOR = token("OPERATOR"), PUNCTUATION = token("PUNCTUATION"),
      LEFT_BRACE = token("LEFT_BRACE"), RIGHT_BRACE = token("RIGHT_BRACE"),
      LEFT_PAREN = token("LEFT_PAREN"), RIGHT_PAREN = token("RIGHT_PAREN"),
      LEFT_BRACKET = token("LEFT_BRACKET"), RIGHT_BRACKET = token("RIGHT_BRACKET");
}
