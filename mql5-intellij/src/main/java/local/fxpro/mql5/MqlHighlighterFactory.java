package local.fxpro.mql5;

import com.intellij.openapi.fileTypes.SyntaxHighlighter;
import com.intellij.openapi.fileTypes.SyntaxHighlighterFactory;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.vfs.VirtualFile;

public final class MqlHighlighterFactory extends SyntaxHighlighterFactory {
  @Override public SyntaxHighlighter getSyntaxHighlighter(Project project, VirtualFile file) {
    return new MqlHighlighter();
  }
}
