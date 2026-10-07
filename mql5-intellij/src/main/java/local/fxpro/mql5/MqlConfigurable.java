package local.fxpro.mql5;

import com.intellij.openapi.options.Configurable;
import javax.swing.*;
import java.awt.*;

public final class MqlConfigurable implements Configurable {
  private JTextField node, server, compiler;
  private JTextArea includes;
  @Override public String getDisplayName() { return "MQL5"; }
  @Override public JComponent createComponent() {
    JPanel panel = new JPanel(new GridLayout(0, 1, 0, 6));
    node = new JTextField(); server = new JTextField(); compiler = new JTextField(); includes = new JTextArea(4, 60);
    panel.add(new JLabel("Node.js executable (blank: detect automatically)")); panel.add(node);
    panel.add(new JLabel("Language server script (blank: bundled server)")); panel.add(server);
    panel.add(new JLabel("MT5 include directories (one path per line; blank: project configuration)")); panel.add(new JScrollPane(includes));
    panel.add(new JLabel("UTM compiler bridge mac-dev.py (blank: detect from source location)")); panel.add(compiler);
    panel.add(new JLabel("Reopen the project or restart its language server after changing these settings."));
    reset(); return panel;
  }
  @Override public boolean isModified() {
    if (node == null) return false;
    MqlSettings s = MqlSettings.getInstance();
    return !node.getText().equals(s.nodeExecutable) || !server.getText().equals(s.serverScript)
        || !includes.getText().equals(s.includeDirectories) || !compiler.getText().equals(s.compilerBridge);
  }
  @Override public void apply() {
    MqlSettings s = MqlSettings.getInstance();
    s.nodeExecutable = node.getText().trim(); s.serverScript = server.getText().trim();
    s.includeDirectories = includes.getText().trim(); s.compilerBridge = compiler.getText().trim();
  }
  @Override public void reset() {
    if (node == null) return;
    MqlSettings s = MqlSettings.getInstance();
    node.setText(s.nodeExecutable); server.setText(s.serverScript);
    includes.setText(s.includeDirectories); compiler.setText(s.compilerBridge);
  }
  @Override public void disposeUIResources() { node = null; server = null; compiler = null; includes = null; }
}
