package local.fxpro.mql5;

import com.intellij.psi.TokenType;
import com.intellij.psi.tree.IElementType;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import static local.fxpro.mql5.MqlTokens.*;

public final class MqlLexerTest {
  private record Token(IElementType type, int start, int end, int state, String text) {}
  private static int checks;
  private static void require(boolean value, String message) {
    checks++;
    if (!value) throw new AssertionError(message);
  }
  private static List<Token> lex(String source) {
    MqlLexer lexer = new MqlLexer();
    lexer.start(source);
    List<Token> tokens = new ArrayList<>();
    int offset = 0;
    while (lexer.getTokenType() != null) {
      require(lexer.getTokenStart() == offset && lexer.getTokenEnd() > offset && lexer.getTokenEnd() <= source.length(),
          "Lexer gap, overlap or zero-length token at " + offset);
      tokens.add(new Token(lexer.getTokenType(), offset, lexer.getTokenEnd(), lexer.getState(),
          source.substring(offset, lexer.getTokenEnd())));
      offset = lexer.getTokenEnd();
      lexer.advance();
    }
    require(offset == source.length(), "Lexer must cover entire input");
    return tokens;
  }
  private static List<Token> significant(String source) {
    return lex(source).stream().filter(token -> token.type != TokenType.WHITE_SPACE).toList();
  }
  private static void types(String source, IElementType... expected) {
    List<Token> tokens = significant(source);
    require(tokens.size() == expected.length, "Unexpected tokens: " + tokens);
    for (int i = 0; i < expected.length; i++) require(tokens.get(i).type == expected[i], "Wrong token: " + tokens.get(i));
  }
  private static void restart(String source) {
    List<Token> tokens = lex(source);
    for (int index = 0; index < tokens.size(); index++) {
      Token first = tokens.get(index);
      MqlLexer lexer = new MqlLexer();
      lexer.start(source, first.start, source.length(), first.state);
      for (int i = index; i < tokens.size(); i++) {
        Token expected = tokens.get(i);
        require(lexer.getTokenType() == expected.type && lexer.getTokenStart() == expected.start
            && lexer.getTokenEnd() == expected.end && lexer.getState() == expected.state,
            "Incremental restart mismatch at " + expected);
        lexer.advance();
      }
      require(lexer.getTokenType() == null, "Restart failed to finish");
    }
  }
  public static void main(String[] args) throws Exception {
    types("input double Lots = 1.5;", KEYWORD, TYPE, INPUT_VARIABLE, OPERATOR, NUMBER, PUNCTUATION);
    types("#property strict\n#include <Trade/Trade.mqh>", DIRECTIVE, IDENTIFIER, DIRECTIVE, STRING);
    types("  # include \"local.mqh\"", DIRECTIVE, STRING);
    types("double _Point; ENUM_TIMEFRAMES tf = PERIOD_M15;", TYPE, PREDEFINED, PUNCTUATION,
        TYPE, IDENTIFIER, OPERATOR, CONSTANT, PUNCTUATION);
    types("input ENUM_BASE_CORNER InpCorner = CORNER_LEFT_UPPER;", KEYWORD, TYPE, INPUT_VARIABLE, OPERATOR, CONSTANT, PUNCTUATION);
    types("Print(\"// not a comment \\\"quote\\\"\");", BUILTIN_FUNCTION, LEFT_PAREN, STRING, RIGHT_PAREN, PUNCTUATION);
    types("D'2026.10.06 12:00' C'255,0,0' '\\n'", DATE, COLOR, CHARACTER);
    types("0xFF 0.25 .5 2e-3 5E+2 42UL", NUMBER, NUMBER, NUMBER, NUMBER, NUMBER, NUMBER);
    types("// input double\n/* if\nreturn */ int", LINE_COMMENT, BLOCK_COMMENT, BLOCK_COMMENT, TYPE);
    types("\"unterminated\nint value;", STRING, TYPE, IDENTIFIER, PUNCTUATION);
    types("/* unfinished", BLOCK_COMMENT);
    types("{}()[]", LEFT_BRACE, RIGHT_BRACE, LEFT_PAREN, RIGHT_PAREN, LEFT_BRACKET, RIGHT_BRACKET);
    types("@", TokenType.BAD_CHARACTER);
    types("\uFEFF#property strict", DIRECTIVE, IDENTIFIER);
    types("a < b", IDENTIFIER, OPERATOR, IDENTIFIER);
    types("MqlTick tick; MqlTradeRequest request; MqlCalendarEvent event;", TYPE, IDENTIFIER, PUNCTUATION, TYPE, IDENTIFIER, PUNCTUATION, TYPE, IDENTIFIER, PUNCTUATION);
    types("ObjectSetInteger OnInit iMA _Symbol clrRed", BUILTIN_FUNCTION, ENTRY_POINT, INDICATOR, PREDEFINED, CONSTANT);
    types("#property indicator_type1 DRAW_LINE", DIRECTIVE, INDICATOR, CONSTANT);
    types("input double Risk=1; Print(Risk);", KEYWORD, TYPE, INPUT_VARIABLE, OPERATOR, NUMBER, PUNCTUATION, BUILTIN_FUNCTION, LEFT_PAREN, INPUT_VARIABLE, RIGHT_PAREN, PUNCTUATION);
    types("input int ENUM_OPTION=1;", KEYWORD, TYPE, INPUT_VARIABLE, OPERATOR, NUMBER, PUNCTUATION);
    types("#define MixedMacro 3\nMixedMacro", DIRECTIVE, MACRO, NUMBER, MACRO);
    types("#define X input double fake;\nfake", DIRECTIVE, MACRO, KEYWORD, TYPE, IDENTIFIER, PUNCTUATION, IDENTIFIER);
    types("// input double Ghost;\nstring note=\"input int Hidden;\"; Ghost Hidden", LINE_COMMENT, TYPE, IDENTIFIER, OPERATOR, STRING, PUNCTUATION, IDENTIFIER, IDENTIFIER);
    restart("input group \"Controls\"\ninput\n ENUM_BASE_CORNER Corner=CORNER_LEFT_UPPER;\nPrint(Corner);\n#define Name(x) x\nName(Corner);\n");
    types("#define debug \\\r\n Print", DIRECTIVE, MACRO, OPERATOR, BUILTIN_FUNCTION);
    restart("#include <local.mqh>\r\n/* one\r\n two\n end */ double x = 2e-3; // done\n");
    restart("string x = \"first\\\nsecond\";\nint y;\n");
    Random random = new Random(5);
    String alphabet = "abcABC019_/\\\"'{}[]()#*+-. \n\r\t\uFEFF@\u0416";
    for (int i = 0; i < 400; i++) {
      StringBuilder input = new StringBuilder();
      for (int j = 0; j < 80; j++) input.append(alphabet.charAt(random.nextInt(alphabet.length())));
      restart(input.toString());
    }
    int files = 0;
    Path workspace = Path.of(args[0]);
    for (String project : List.of("mt5-fibo-readout", "mt5-structure-engine", "mt5-tv-volume")) {
      Path root = workspace.resolve(project);
      if (!Files.exists(root)) continue;
      try (var paths = Files.walk(root)) {
        for (Path file : paths.filter(Files::isRegularFile)
            .filter(p -> p.toString().endsWith(".mq5") || p.toString().endsWith(".mqh"))
            .filter(p -> !root.relativize(p).startsWith("dist")).toList()) {
          List<Token> tokens = lex(Files.readString(file));
          require(tokens.stream().noneMatch(token -> token.type == TokenType.BAD_CHARACTER), "Unexpected character in " + file);
          files++;
        }
      }
    }
    require(MqlFileType.INSTANCE.getLanguage() == MqlLanguage.INSTANCE, "File type language");
    require(MqlBuiltins.FUNCTIONS.size() > 400 && MqlBuiltins.CONSTANTS.size() > 1000 && !MqlBuiltins.FUNCTIONS.contains("initialize"), "Built-in catalog excludes Python API");
    StringBuilder mutable = new StringBuilder("input int Old=1; Old");
    MqlLexer changed = new MqlLexer(); changed.start(mutable, 0, mutable.length(), 0);
    mutable.replace(mutable.indexOf("Old"), mutable.indexOf("Old") + 3, "New");
    changed.start(mutable, 0, mutable.length(), 0);
    while (changed.getTokenType() != null && changed.getTokenEnd() < mutable.length()) changed.advance();
    require(changed.getTokenType() == IDENTIFIER, "Renamed input must not leave stale highlighting on a mutable buffer");
    require(MqlFileType.INSTANCE.getDefaultExtension().equals("mq5"), "File extension");
    MqlHighlighter highlighter = new MqlHighlighter();
    require(highlighter.getTokenHighlights(KEYWORD).length == 1, "Keyword color");
    require(highlighter.getTokenHighlights(TokenType.WHITE_SPACE).length == 0, "Whitespace color");
    require(new MqlHighlighterFactory().getSyntaxHighlighter(null, null) instanceof MqlHighlighter, "Highlighter factory");
    require(new MqlBraceMatcher().getPairs().length == 3, "Brace pairs");
    require(new MqlCommenter().getLineCommentPrefix().equals("//"), "Line commenter");
    require(new MqlParserDefinition().getFileNodeType() != null, "Parser file type");
    require(new MqlColorSettings().getAttributeDescriptors().length == 20, "Color settings");
    require(MqlLspSupport.supports("mq5") && MqlLspSupport.supports("MQH") && !MqlLspSupport.supports("csv"), "LSP file association");
    Path helpDirectory = Files.createTempDirectory("mql5 help ");
    Path helpFile = helpDirectory.resolve("\u0442\u0435\u043c\u0430.htm");
    Files.writeString(helpFile, "<html>MQL5 help</html>");
    java.util.List<Path> opened = new java.util.ArrayList<>();
    MqlHelpLinkHandler links = new MqlHelpLinkHandler(opened::add);
    require(links.openLink("mql5-help:" + helpFile.toUri()), "Local help link opens HTML");
    require(opened.size() == 1 && opened.get(0).equals(helpFile), "Browser receives exact decoded help path");
    require(!links.openLink("https://www.mql5.com/en/docs"), "Online links use standard handler");
    require(!links.openLink("mql5-help:https://www.mql5.com/en/docs"), "Custom help accepts only files");
    require(!links.openLink("mql5-help:" + helpDirectory.resolve("missing.htm").toUri()), "Missing help file is rejected");
    require(!links.openLink("mql5-help:" + helpDirectory.toUri()), "Directories are rejected");
    require(!links.openLink("mql5-help:file:///bad%XX.htm"), "Malformed URI is rejected");
    com.intellij.openapi.project.Project stubProject = (com.intellij.openapi.project.Project)
        java.lang.reflect.Proxy.newProxyInstance(MqlLexerTest.class.getClassLoader(),
            new Class<?>[]{com.intellij.openapi.project.Project.class},
            (proxy, method, values) -> method.getReturnType() == boolean.class ? false : null);
    String customHelp = "mql5-help:" + helpFile.toUri();
    String html = com.intellij.markdown.utils.doc.DocMarkdownToHtmlConverter.convert(stubProject,
        "[Local HTML reference](" + customHelp + ")");
    require(html.contains("href=\"" + customHelp + "\""), "IDE converter preserves custom help URL");
    String stripped = com.intellij.markdown.utils.doc.DocMarkdownToHtmlConverter.convert(stubProject,
        "[Local HTML reference](" + helpFile.toUri() + ")");
    require(stripped.contains("href=\"#\""), "IDE converter strips plain file links: regression cause");
    lex(new MqlColorSettings().getDemoText());
    System.out.printf("Passed %,d checks; 400 fuzz cases; %d real MQL5 files%n", checks, files);
  }
}
