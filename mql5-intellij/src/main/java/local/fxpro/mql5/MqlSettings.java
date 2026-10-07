package local.fxpro.mql5;

import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.components.PersistentStateComponent;
import com.intellij.openapi.components.State;
import com.intellij.openapi.components.Storage;

@State(name = "Mql5Settings", storages = @Storage("mql5.xml"))
public final class MqlSettings implements PersistentStateComponent<MqlSettings> {
  public String nodeExecutable = "";
  public String serverScript = "";
  public String includeDirectories = "";
  public String compilerBridge = "";
  public static MqlSettings getInstance() { return ApplicationManager.getApplication().getService(MqlSettings.class); }
  @Override public MqlSettings getState() { return this; }
  @Override public void loadState(MqlSettings state) {
    nodeExecutable = state.nodeExecutable; serverScript = state.serverScript;
    includeDirectories = state.includeDirectories; compilerBridge = state.compilerBridge;
  }
}
