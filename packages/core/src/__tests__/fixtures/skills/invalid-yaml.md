---
name: invalid-yaml
description: This has invalid YAML syntax
metadata:
  - this is a list
  but: this is a dict
  [invalid: syntax
---

# Invalid YAML

This should fail to parse due to invalid YAML.
