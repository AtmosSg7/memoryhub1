"""Concrete PDP provider adapters.

Implement ``PdpProvider`` in a dedicated module under this package, then register
the instance at application startup via ``register_pdp_provider()``.

MemoryHub V1 ships no real provider — this package is an extension point only.
"""
