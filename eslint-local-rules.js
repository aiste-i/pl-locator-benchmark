const fs = require('fs');
const path = require('path');

const REALWORLD_LOCATOR_MODULE_PATTERN = /src[\\/]locators[\\/]apps[\\/](angular|react|vue3)-realworld\.locators\.ts$/;
const REALWORLD_CORPUS_PATTERN = /src[\\/]benchmark[\\/]realworld-corpus\.ts$/;
const EXPECTED_APP_BY_MODULE = {
  'angular-realworld.locators.ts': 'angular-realworld-example-app',
  'react-realworld.locators.ts': 'realworld',
  'vue3-realworld.locators.ts': 'vue3-realworld-example-app',
};

const SEMANTIC_ENTRY_POINTS = new Set([
  'getByRole',
  'getByLabel',
  'getByText',
  'getByPlaceholder',
  'getByAltText',
  'getByTitle',
]);

const NON_CSS_FACTORY_METHODS = new Set([
  ...SEMANTIC_ENTRY_POINTS,
  'getByTestId',
]);

const ALLOWED_SOURCE_SPEC_STATUSES = new Set([
  'migrated',
  'excluded-by-design',
  'excluded-methodological',
]);

let cachedActiveLogicalKeys = null;

module.exports = {
  'realworld-corpus-status': {
    meta: {
      type: 'problem',
      messages: {
        missingSourceSpecs: 'REALWORLD_CORPUS_MANIFEST.sourceSpecs must contain explicit source-spec dispositions.',
        invalidSourceStatus: 'Unexpected source-spec status "{{ status }}". Use migrated, excluded-by-design, or excluded-methodological.',
      },
    },
    create(context) {
      return {
        Program(node) {
          if (!REALWORLD_CORPUS_PATTERN.test(getContextFilename(context))) {
            return;
          }

          const sourceSpecs = findPropertyValue(node, 'sourceSpecs');
          if (!sourceSpecs || sourceSpecs.type !== 'ArrayExpression' || sourceSpecs.elements.length === 0) {
            context.report({ node, messageId: 'missingSourceSpecs' });
            return;
          }

          for (const element of sourceSpecs.elements) {
            if (!element || element.type !== 'ObjectExpression') {
              continue;
            }
            const status = stringPropertyValue(element, 'status');
            if (!ALLOWED_SOURCE_SPEC_STATUSES.has(status)) {
              context.report({
                node: propertyNode(element, 'status') || element,
                messageId: 'invalidSourceStatus',
                data: { status: status || '<missing>' },
              });
            }
          }
        },
      };
    },
  },

  'realworld-locator-purity': {
    meta: {
      type: 'problem',
      messages: {
        cssSelectorInvalid: 'css(...) metadata selector must be CSS-only and must not use oracle data-testid anchors. Found: "{{ selector }}"',
        xpathSelectorInvalid: 'xpath(...) metadata selector must be XPath-only and must not use oracle data-testid anchors. Found: "{{ selector }}"',
        xpathFactoryInvalid: 'xpath(...) custom locator factory must use locator("xpath=...") and must not use semantic/oracle entry points.',
        cssFactoryInvalid: 'css(...) custom locator factory must not use xpath selectors or semantic/oracle Playwright entry points.',
        semanticFactoryInvalid: 'semanticNative(...) must use an approved semantic entry point and must not use locator() or getByTestId().',
        semanticAntiPattern: 'semantic-first locators must not use hasText filters or chained getByText narrowing.',
        oracleFactoryInvalid: 'oracle(...) custom locator factory must use getByTestId() and must not use locator(), filters, semantic entry points, CSS, or XPath.',
        oracleHelperInvalid: 'oracle helper metadata must be a getByTestId or getByTestId-chain declaration.',
        oracleSectionInvalid: 'oracle sections must not use filters, locator(), or semantic Playwright entry points.',
        missingActiveLocator: 'Missing {{ family }} locator for active logical key "{{ logicalKey }}".',
        invalidAppId: 'Locator module APP_ID must be "{{ expected }}". Found "{{ actual }}".',
        invalidModuleId: 'Locator module MODULE_ID must match its source path. Found "{{ actual }}".',
        semanticExceptionInvalid: 'semanticCssException(...) must include cssSelector, reason, activeInCorpus, and affectsFairComparisonWording metadata.',
      },
    },
    create(context) {
      const filename = getContextFilename(context);
      if (!REALWORLD_LOCATOR_MODULE_PATTERN.test(filename)) {
        return {};
      }

      const coverage = {
        'semantic-first': new Set(),
        css: new Set(),
        xpath: new Set(),
        oracle: new Set(),
      };

      return {
        Program(node) {
          validateModuleConstants(context, node, filename);
        },

        CallExpression(node) {
          const name = calleeName(node);

          if (name === 'semanticNative') {
            const logicalKey = logicalKeyFromContext(node.arguments[0]);
            if (logicalKey) {
              coverage['semantic-first'].add(logicalKey);
            }
            validateSemanticNativeCall(context, node);
            return;
          }

          if (name === 'semanticCssException') {
            const logicalKey = logicalKeyFromContext(node.arguments[0]);
            if (logicalKey) {
              coverage['semantic-first'].add(logicalKey);
            }
            validateSemanticCssExceptionCall(context, node);
            return;
          }

          if (name === 'css') {
            const logicalKey = logicalKeyFromContext(node.arguments[0]);
            if (logicalKey) {
              coverage.css.add(logicalKey);
            }
            validateCssCall(context, node);
            return;
          }

          if (name === 'xpath') {
            const logicalKey = logicalKeyFromContext(node.arguments[0]);
            if (logicalKey) {
              coverage.xpath.add(logicalKey);
            }
            validateXpathCall(context, node);
            return;
          }

          if (name === 'oracle') {
            const logicalKey = logicalKeyFromContext(node.arguments[0]);
            if (logicalKey) {
              coverage.oracle.add(logicalKey);
            }
            validateOracleCall(context, node);
            return;
          }

          if (name === 'oracleTestId' || name === 'oracleDynamicTestId' || name === 'oracleTestIdChain') {
            const logicalKey = logicalKeyFromMetaCall(node.arguments[0]);
            if (logicalKey) {
              coverage.oracle.add(logicalKey);
            }
            validateOracleHelperCall(context, node);
            return;
          }

          if (isSemanticAntiPattern(node)) {
            context.report({ node, messageId: 'semanticAntiPattern' });
          }
        },

        'FunctionDeclaration:exit'(node) {
          if (!node.id?.name || !/^get.*Oracle$/.test(node.id.name)) {
            return;
          }

          traverse(node.body, current => {
            if (current.type !== 'CallExpression') {
              return;
            }
            const name = calleeName(current);
            if (
              name === 'filter' ||
              name === 'locator' ||
              SEMANTIC_ENTRY_POINTS.has(name)
            ) {
              context.report({ node: current, messageId: 'oracleSectionInvalid' });
            }
          });
        },

        'Program:exit'(node) {
          for (const logicalKey of getActiveLogicalKeys(context)) {
            for (const family of Object.keys(coverage)) {
              if (!coverage[family].has(logicalKey)) {
                context.report({
                  node,
                  messageId: 'missingActiveLocator',
                  data: { family, logicalKey },
                });
              }
            }
          }
        },
      };
    },
  },
};

function validateCssCall(context, node) {
  const selector = selectorFromContext(node.arguments[0], 'selector');
  if (!selector || selector.startsWith('xpath=') || selector.includes('data-testid')) {
    context.report({
      node,
      messageId: 'cssSelectorInvalid',
      data: { selector: selector || '<missing>' },
    });
  }

  const factory = node.arguments[1];
  if (!factory) {
    return;
  }

  if (
    containsAnyCall(factory, NON_CSS_FACTORY_METHODS) ||
    containsLocatorWithPrefix(factory, 'xpath=')
  ) {
    context.report({ node: factory, messageId: 'cssFactoryInvalid' });
  }
}

function validateXpathCall(context, node) {
  const selector = selectorFromContext(node.arguments[0], 'selector');
  if (!selector || selector.startsWith('css=') || selector.includes('data-testid')) {
    context.report({
      node,
      messageId: 'xpathSelectorInvalid',
      data: { selector: selector || '<missing>' },
    });
  }

  const factory = node.arguments[1];
  if (!factory) {
    return;
  }

  if (
    containsAnyCall(factory, NON_CSS_FACTORY_METHODS) ||
    containsLocatorWithoutPrefix(factory, 'xpath=')
  ) {
    context.report({ node: factory, messageId: 'xpathFactoryInvalid' });
  }
}

function validateSemanticNativeCall(context, node) {
  const factory = node.arguments[1];
  if (!factory) {
    context.report({ node, messageId: 'semanticFactoryInvalid' });
    return;
  }

  if (
    !containsAnyCall(factory, SEMANTIC_ENTRY_POINTS) ||
    containsCall(factory, 'locator') ||
    containsCall(factory, 'getByTestId')
  ) {
    context.report({ node: factory, messageId: 'semanticFactoryInvalid' });
  }
}

function validateSemanticCssExceptionCall(context, node) {
  const metadata = node.arguments[0];
  if (
    !selectorFromContext(metadata, 'cssSelector') ||
    !selectorFromContext(metadata, 'reason') ||
    typeof booleanPropertyValue(metadata, 'activeInCorpus') !== 'boolean' ||
    typeof booleanPropertyValue(metadata, 'affectsFairComparisonWording') !== 'boolean'
  ) {
    context.report({ node, messageId: 'semanticExceptionInvalid' });
  }
}

function validateOracleCall(context, node) {
  const selector = selectorFromContext(node.arguments[0], 'selector');
  if (!selector || !/^getByTestId\('[^']+'\)(\.getByTestId\('[^']+'\))*$/.test(selector)) {
    context.report({ node, messageId: 'oracleHelperInvalid' });
  }

  const factory = node.arguments[1];
  if (!factory) {
    return;
  }

  if (
    !containsCall(factory, 'getByTestId') ||
    containsCall(factory, 'locator') ||
    containsCall(factory, 'filter') ||
    containsAnyCall(factory, SEMANTIC_ENTRY_POINTS)
  ) {
    context.report({ node: factory, messageId: 'oracleFactoryInvalid' });
  }
}

function validateModuleConstants(context, program, filename) {
  const moduleName = filename.split('/').pop();
  const expectedAppId = EXPECTED_APP_BY_MODULE[moduleName];
  if (!expectedAppId) {
    return;
  }

  const appId = constStringValue(program, 'APP_ID');
  if (appId !== expectedAppId) {
    context.report({
      node: program,
      messageId: 'invalidAppId',
      data: { expected: expectedAppId, actual: appId || '<missing>' },
    });
  }

  const moduleId = constStringValue(program, 'MODULE_ID');
  const expectedModuleSuffix = `src/locators/apps/${moduleName}`;
  if (moduleId !== expectedModuleSuffix) {
    context.report({
      node: program,
      messageId: 'invalidModuleId',
      data: { actual: moduleId || '<missing>' },
    });
  }
}

function validateOracleHelperCall(context, node) {
  const name = calleeName(node);
  if (name === 'oracleTestIdChain') {
    if (!isStringArray(node.arguments[1])) {
      context.report({ node, messageId: 'oracleHelperInvalid' });
    }
    return;
  }

  if (!isStringLike(node.arguments[1])) {
    context.report({ node, messageId: 'oracleHelperInvalid' });
  }
}

function isSemanticAntiPattern(node) {
  if (calleeName(node) === 'filter') {
    return node.arguments.some(argument =>
      argument.type === 'ObjectExpression' &&
      argument.properties.some(property =>
        property.type === 'Property' &&
        propertyKeyName(property) === 'hasText',
      ),
    );
  }

  return calleeName(node) === 'getByText' && node.callee.type === 'MemberExpression' && node.callee.object.type === 'CallExpression';
}

function normalizeFilename(filename) {
  return filename.replace(/\\/g, '/');
}

function getContextFilename(context) {
  return normalizeFilename(context.filename || context.getFilename?.() || '');
}

function calleeName(node) {
  if (!node || !node.callee) {
    return null;
  }
  if (node.callee.type === 'Identifier') {
    return node.callee.name;
  }
  if (node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.type === 'Identifier') {
    return node.callee.property.name;
  }
  return null;
}

function propertyKeyName(property) {
  if (!property || property.type !== 'Property') {
    return null;
  }
  if (property.key.type === 'Identifier') {
    return property.key.name;
  }
  return property.key.value;
}

function propertyNode(objectExpression, propertyName) {
  return objectExpression.properties.find(property => property.type === 'Property' && propertyKeyName(property) === propertyName) || null;
}

function findPropertyValue(node, propertyName) {
  let result = null;
  traverse(node, current => {
    if (result || current.type !== 'Property' || propertyKeyName(current) !== propertyName) {
      return;
    }
    result = current.value;
  });
  return result;
}

function stringPropertyValue(objectExpression, propertyName) {
  const property = propertyNode(objectExpression, propertyName);
  return property ? stringValue(property.value) : null;
}

function booleanPropertyValue(objectExpression, propertyName) {
  const property = propertyNode(objectExpression, propertyName);
  if (!property || property.value.type !== 'Literal' || typeof property.value.value !== 'boolean') {
    return null;
  }
  return property.value.value;
}

function constStringValue(program, constName) {
  for (const statement of program.body) {
    if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const') {
      continue;
    }
    for (const declaration of statement.declarations) {
      if (declaration.id.type === 'Identifier' && declaration.id.name === constName) {
        return stringValue(declaration.init);
      }
    }
  }
  return null;
}

function selectorFromContext(node, propertyName) {
  if (!node || node.type !== 'ObjectExpression') {
    return null;
  }
  return stringPropertyValue(node, propertyName);
}

function logicalKeyFromContext(node) {
  if (!node || node.type !== 'ObjectExpression') {
    return null;
  }

  for (const property of node.properties) {
    if (property.type === 'SpreadElement') {
      const logicalKey = logicalKeyFromMetaCall(property.argument);
      if (logicalKey) {
        return logicalKey;
      }
    }
    if (property.type === 'Property' && propertyKeyName(property) === 'logicalKey') {
      return stringValue(property.value);
    }
  }

  return null;
}

function logicalKeyFromMetaCall(node) {
  if (
    node &&
    node.type === 'CallExpression' &&
    calleeName(node) === 'meta' &&
    node.arguments.length > 0
  ) {
    return stringValue(node.arguments[0]);
  }
  return null;
}

function stringValue(node) {
  if (!node) {
    return null;
  }
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map(quasi => quasi.value.cooked).join('');
  }
  return null;
}

function containsCall(node, methodName) {
  let found = false;
  traverse(node, current => {
    if (current.type === 'CallExpression' && calleeName(current) === methodName) {
      found = true;
    }
  });
  return found;
}

function containsAnyCall(node, methodNames) {
  let found = false;
  traverse(node, current => {
    if (current.type === 'CallExpression' && methodNames.has(calleeName(current))) {
      found = true;
    }
  });
  return found;
}

function containsLocatorWithPrefix(node, prefix) {
  let found = false;
  traverse(node, current => {
    if (current.type !== 'CallExpression' || calleeName(current) !== 'locator') {
      return;
    }
    const selector = locatorSelectorPrefix(current);
    if (selector && selector.startsWith(prefix)) {
      found = true;
    }
  });
  return found;
}

function containsLocatorWithoutPrefix(node, prefix) {
  let found = false;
  traverse(node, current => {
    if (current.type !== 'CallExpression' || calleeName(current) !== 'locator') {
      return;
    }
    const selector = locatorSelectorPrefix(current);
    if (!selector || !selector.startsWith(prefix)) {
      found = true;
    }
  });
  return found;
}

function locatorSelectorPrefix(callExpression) {
  const firstArg = callExpression.arguments[0];
  if (!firstArg) {
    return null;
  }
  if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
    return firstArg.value;
  }
  if (firstArg.type === 'TemplateLiteral') {
    return firstArg.quasis[0]?.value.raw || null;
  }
  return null;
}

function isStringLike(node) {
  return Boolean(stringValue(node));
}

function isStringArray(node) {
  return Boolean(
    node &&
      node.type === 'ArrayExpression' &&
      node.elements.length > 0 &&
      node.elements.every(element => isStringLike(element)),
  );
}

function getActiveLogicalKeys(context) {
  if (cachedActiveLogicalKeys) {
    return cachedActiveLogicalKeys;
  }

  const cwd = context.cwd || context.getCwd?.() || process.cwd();
  const corpusPath = path.join(cwd, 'src', 'benchmark', 'realworld-corpus.ts');
  const contents = fs.readFileSync(corpusPath, 'utf8');
  const primaryManifest = contents.split('export const REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST')[0] || contents;
  const activeBlocks = [...primaryManifest.matchAll(/status:\s*'active'[\s\S]*?logicalKeys:\s*\[([\s\S]*?)\]/g)];
  const keys = new Set();
  for (const block of activeBlocks) {
    for (const keyMatch of block[1].matchAll(/'([^']+)'/g)) {
      keys.add(keyMatch[1]);
    }
  }
  cachedActiveLogicalKeys = [...keys].sort();
  return cachedActiveLogicalKeys;
}

function traverse(node, visitor) {
  if (!node || typeof node.type !== 'string') {
    return;
  }

  visitor(node);

  for (const key of Object.keys(node)) {
    if (key === 'parent') {
      continue;
    }
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) {
        traverse(child, visitor);
      }
    } else if (value && typeof value.type === 'string') {
      traverse(value, visitor);
    }
  }
}
