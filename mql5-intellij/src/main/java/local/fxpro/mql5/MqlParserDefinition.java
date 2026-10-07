package local.fxpro.mql5;

import com.intellij.extapi.psi.ASTWrapperPsiElement;
import com.intellij.extapi.psi.PsiFileBase;
import com.intellij.lang.ASTNode;
import com.intellij.lang.ParserDefinition;
import com.intellij.lang.PsiParser;
import com.intellij.lexer.Lexer;
import com.intellij.openapi.fileTypes.FileType;
import com.intellij.openapi.project.Project;
import com.intellij.psi.FileViewProvider;
import com.intellij.psi.PsiElement;
import com.intellij.psi.PsiFile;
import com.intellij.psi.tree.IFileElementType;
import com.intellij.psi.tree.TokenSet;

/** Flat PSI keeps editing/comment actions available; this is not a semantic parser. */
public final class MqlParserDefinition implements ParserDefinition {
  public static final IFileElementType FILE = new IFileElementType(MqlLanguage.INSTANCE);
  @Override public Lexer createLexer(Project project) { return new MqlLexer(); }
  @Override public PsiParser createParser(Project project) {
    return (root, builder) -> {
      var marker = builder.mark();
      while (!builder.eof()) builder.advanceLexer();
      marker.done(root);
      return builder.getTreeBuilt();
    };
  }
  @Override public IFileElementType getFileNodeType() { return FILE; }
  @Override public TokenSet getCommentTokens() { return TokenSet.create(MqlTokens.LINE_COMMENT, MqlTokens.BLOCK_COMMENT); }
  @Override public TokenSet getStringLiteralElements() { return TokenSet.create(MqlTokens.STRING, MqlTokens.CHARACTER); }
  @Override public PsiElement createElement(ASTNode node) { return new ASTWrapperPsiElement(node); }
  @Override public PsiFile createFile(FileViewProvider provider) { return new MqlFile(provider); }
  private static final class MqlFile extends PsiFileBase {
    MqlFile(FileViewProvider provider) { super(provider, MqlLanguage.INSTANCE); }
    @Override public FileType getFileType() { return MqlFileType.INSTANCE; }
  }
}
