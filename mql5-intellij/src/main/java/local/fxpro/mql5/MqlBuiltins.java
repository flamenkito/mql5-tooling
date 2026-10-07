package local.fxpro.mql5;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** API identifiers imported from the official reference, without copying prose. */
public final class MqlBuiltins {
  private static final Map<String, Set<String>> CATALOG = load();
  public static final Set<String> TYPES = CATALOG.get("types"), FUNCTIONS = CATALOG.get("functions"),
      CONSTANTS = CATALOG.get("constants"), EVENTS = CATALOG.get("events"),
      INDICATORS = CATALOG.get("indicators"), PREDEFINED = CATALOG.get("predefined");
  private static Map<String, Set<String>> load() {
    Map<String, Set<String>> entries = new HashMap<>();
    for (String category : Set.of("types", "functions", "constants", "events", "indicators", "predefined")) entries.put(category, new HashSet<>());
    var stream = MqlBuiltins.class.getResourceAsStream("/mql5-catalog.tsv");
    if (stream == null) throw new IllegalStateException("MQL5 catalog resource is missing");
    try (var reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
      for (String line; (line = reader.readLine()) != null;) {
        String[] item = line.split("\\t", 2);
        if (item.length == 2 && entries.containsKey(item[0])) entries.get(item[0]).add(item[1]);
      }
    } catch (IOException error) { throw new IllegalStateException("Cannot read MQL5 catalog", error); }
    entries.replaceAll((key, values) -> Set.copyOf(values));
    return Map.copyOf(entries);
  }
  private MqlBuiltins() {}
}
