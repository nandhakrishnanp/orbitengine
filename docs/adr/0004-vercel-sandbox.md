# Vercel Sandbox for sandbox execution

Sandboxes are provisioned through Vercel Sandbox — a managed, on-demand
Firecracker microVM service with a JS SDK — rather than self-managed Docker or
Kubernetes. Each sandbox runs in its own microVM with a dedicated kernel,
network, and filesystem; sandboxes are persistent by default (filesystem
snapshotted on stop, restored on resume). Chosen for stronger isolation than
containers with zero infrastructure to operate. Its default persistence model
matches the "one sandbox per conversation" lifecycle, resumed across turns and
destroyed when the conversation closes.