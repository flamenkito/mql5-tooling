package local.fxpro.mql5;

import com.intellij.execution.configurations.GeneralCommandLine;
import com.intellij.ide.plugins.PluginManagerCore;
import com.intellij.openapi.extensions.PluginId;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.platform.lsp.api.LspServerSupportProvider;
import com.intellij.platform.lsp.api.ProjectWideLspServerDescriptor;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class MqlLspSupport implements LspServerSupportProvider {
  public static boolean supports(String extension) { return "mq5".equalsIgnoreCase(extension) || "mqh".equalsIgnoreCase(extension); }
  @Override public void fileOpened(Project project, VirtualFile file, LspServerStarter starter) {
    if (supports(file.getExtension())) starter.ensureServerStarted(new Descriptor(project));
  }
  private static final class Descriptor extends ProjectWideLspServerDescriptor {
    Descriptor(Project project) { super(project, "MQL5"); }
    @Override public boolean isSupportedFile(VirtualFile file) { return supports(file.getExtension()); }
    @Override public String getLanguageId(VirtualFile file) { return "mql5"; }
    @Override public GeneralCommandLine createCommandLine() {
      MqlSettings settings = MqlSettings.getInstance();
      String node = settings.nodeExecutable;
      if (node.isBlank()) {
        node = List.of("/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node")
            .stream().filter(p -> Files.isExecutable(Path.of(p))).findFirst().orElse("node");
      }
      String server = settings.serverScript;
      if (server.isBlank()) server = PluginManagerCore.getPlugin(PluginId.getId("local.fxpro.mql5"))
          .getPluginPath().resolve("server/src/server.mjs").toString();
      GeneralCommandLine command = new GeneralCommandLine(node, server);
      if (getProject().getBasePath() != null) command.withWorkDirectory(getProject().getBasePath());
      return command;
    }
    @Override public Object createInitializationOptions() {
      MqlSettings settings = MqlSettings.getInstance();
      Map<String, Object> options = new LinkedHashMap<>();
      options.put("localHelpLinkScheme", "mql5-help");
      if (!settings.includeDirectories.isBlank()) options.put("includeDirectories", settings.includeDirectories.lines().filter(s -> !s.isBlank()).toList());
      if (!settings.compilerBridge.isBlank()) options.put("compilerBridge", settings.compilerBridge);
      return options;
    }
  }
}
