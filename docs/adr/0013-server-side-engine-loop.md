# Server-side engine loop; sandbox as execution tool

The engine's control loop runs server-side (the Node service), and the sandbox
is its execution tool. The loop orchestrates sandboxes through the Vercel
Sandbox SDK and pushes file/code/test work into them, streaming output back
into chat. The engine does not live inside the sandbox.