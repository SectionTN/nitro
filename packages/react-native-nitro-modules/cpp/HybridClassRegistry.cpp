//
//  HybridClassRegistry.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 22.07.24.
//

#include <NitroModulesCxx/HybridClassRegistry.hpp>
#include <NitroModulesCxx/HybridObject.hpp>
#include <NitroModulesCxx/HybridNitroModulesProxy.hpp>
#include <NitroModulesCxx/NitroDefines.hpp>
#include <cassert>

namespace margelo::nitro {

std::unordered_map<std::string, std::shared_ptr<const HybridClass>>& HybridClassRegistry::getRegistry() {
  static std::unordered_map<std::string, std::shared_ptr<const HybridClass>> classes = {
    {HybridObject::Class::name, HybridObject::Class::get()},
    {HybridNitroModulesProxy::Class::name, HybridNitroModulesProxy::Class::get()},
  };
  return classes;
}

void HybridClassRegistry::registerHybridClass(const std::shared_ptr<const HybridClass>& hybridClass) {
#ifdef NITRO_DEBUG
  assert(hybridClass != nullptr && "Cannot register a null HybridClass.");
#endif
  auto& registry = getRegistry();
  registry.try_emplace(hybridClass->getName(), hybridClass);
}

jsi::Function HybridClassRegistry::getHybridClass(jsi::Runtime& runtime, const std::string& name) {
  const auto& registry = getRegistry();
  auto entry = registry.find(name);
  if (entry == registry.end()) {
    throw jsi::JSError(runtime, "HybridClass \"" + name + "\" is not registered. Regenerate Nitrogen bindings and rebuild the native app.");
  }
  return entry->second->getOrCreateJSClass(runtime).constructor.getFunction(runtime);
}

bool HybridClassRegistry::hasHybridClass(const std::string& name) {
  return getRegistry().contains(name);
}

std::vector<std::string> HybridClassRegistry::getAllHybridClassNames() {
  const auto& registry = getRegistry();
  std::vector<std::string> names;
  names.reserve(registry.size());
  for (const auto& entry : registry) {
    names.push_back(entry.first);
  }
  return names;
}

} // namespace margelo::nitro
