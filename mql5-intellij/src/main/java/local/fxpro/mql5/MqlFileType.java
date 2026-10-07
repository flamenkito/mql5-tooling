package local.fxpro.mql5;

import com.intellij.openapi.fileTypes.LanguageFileType;
import javax.swing.Icon;

public final class MqlFileType extends LanguageFileType {
  public static final MqlFileType INSTANCE = new MqlFileType();
  private MqlFileType() { super(MqlLanguage.INSTANCE); }
  @Override public String getName() { return "MQL5"; }
  @Override public String getDescription() { return "MQL5 source or header"; }
  @Override public String getDefaultExtension() { return "mq5"; }
  @Override public Icon getIcon() { return null; }
}
