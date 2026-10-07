package local.fxpro.mql5;

import com.intellij.lang.Language;

public final class MqlLanguage extends Language {
  public static final MqlLanguage INSTANCE = new MqlLanguage();
  private MqlLanguage() { super("MQL5"); }
}
