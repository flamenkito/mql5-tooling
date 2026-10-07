package local.fxpro.mql5;

import com.intellij.lang.BracePair;
import com.intellij.lang.PairedBraceMatcher;
import com.intellij.psi.PsiFile;
import com.intellij.psi.tree.IElementType;
import static local.fxpro.mql5.MqlTokens.*;

public final class MqlBraceMatcher implements PairedBraceMatcher {
  @Override public BracePair[] getPairs() {
    return new BracePair[]{new BracePair(LEFT_BRACE, RIGHT_BRACE, true),
        new BracePair(LEFT_PAREN, RIGHT_PAREN, false), new BracePair(LEFT_BRACKET, RIGHT_BRACKET, false)};
  }
  @Override public boolean isPairedBracesAllowedBeforeType(IElementType left, IElementType context) { return true; }
  @Override public int getCodeConstructStart(PsiFile file, int openingBraceOffset) { return openingBraceOffset; }
}
