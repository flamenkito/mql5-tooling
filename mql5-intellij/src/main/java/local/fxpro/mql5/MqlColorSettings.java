package local.fxpro.mql5;

import com.intellij.openapi.editor.colors.TextAttributesKey;
import com.intellij.openapi.fileTypes.SyntaxHighlighter;
import com.intellij.openapi.options.colors.AttributesDescriptor;
import com.intellij.openapi.options.colors.ColorDescriptor;
import com.intellij.openapi.options.colors.ColorSettingsPage;
import javax.swing.Icon;
import java.util.Map;
import static local.fxpro.mql5.MqlHighlighter.*;

public final class MqlColorSettings implements ColorSettingsPage {
  @Override public Icon getIcon() { return null; }
  @Override public SyntaxHighlighter getHighlighter() { return new MqlHighlighter(); }
  @Override public String getDisplayName() { return "MQL5"; }
  @Override public Map<String, TextAttributesKey> getAdditionalHighlightingTagToDescriptorMap() { return null; }
  @Override public ColorDescriptor[] getColorDescriptors() { return ColorDescriptor.EMPTY_ARRAY; }
  @Override public AttributesDescriptor[] getAttributeDescriptors() {
    return new AttributesDescriptor[]{
      new AttributesDescriptor("Keywords", KEYWORD_COLOR), new AttributesDescriptor("Types", TYPE_COLOR),
      new AttributesDescriptor("Function names", FUNCTION_COLOR), new AttributesDescriptor("Constants", CONSTANT_COLOR),
      new AttributesDescriptor("Built-in functions", BUILTIN_FUNCTION_COLOR), new AttributesDescriptor("Event entry points", ENTRY_POINT_COLOR),
      new AttributesDescriptor("Input variables", INPUT_VARIABLE_COLOR), new AttributesDescriptor("Macros", MACRO_COLOR),
      new AttributesDescriptor("Indicators", INDICATOR_COLOR), new AttributesDescriptor("Predefined variables", PREDEFINED_COLOR),
      new AttributesDescriptor("Numbers, dates and colors", NUMBER_COLOR), new AttributesDescriptor("Strings and characters", STRING_COLOR),
      new AttributesDescriptor("Line comments", LINE_COMMENT_COLOR), new AttributesDescriptor("Block comments", BLOCK_COMMENT_COLOR),
      new AttributesDescriptor("Preprocessor directives", DIRECTIVE_COLOR), new AttributesDescriptor("Operators", OPERATOR_COLOR),
      new AttributesDescriptor("Braces", BRACE_COLOR), new AttributesDescriptor("Parentheses", PAREN_COLOR),
      new AttributesDescriptor("Brackets", BRACKET_COLOR), new AttributesDescriptor("Punctuation", PUNCTUATION_COLOR)};
  }
  @Override public String getDemoText() {
    return """
        #property strict
        #property indicator_chart_window
        #define MaxBars 1000
        #include <Trade/Trade.mqh>
        // Inputs and platform types
        input double RiskPercent = 1.5;
        input color LineColor = C'255,128,0';
        input ENUM_BASE_CORNER Corner = CORNER_LEFT_UPPER;
        MqlTick tick;
        datetime Since = D'2026.10.06 12:00';
        /* MQL5 example
           with a multiline comment. */
        int OnInit()
        {
           string message = "Symbol: " + _Symbol;
           double prices[2] = {1.0, 2.5e-3};
           Print(message, _Point);
           SymbolInfoTick(_Symbol, tick);
           Print(RiskPercent, MaxBars);
           if (RiskPercent > 0.0) return INIT_SUCCEEDED;
           return INIT_PARAMETERS_INCORRECT;
        }
        """;
  }
}
