# Global Control-Flow

Use this reference when implementing the global `component? -> input -> effect(action) -> controller(action) -> helper -> effect` path.

## Principle

The `action` is the controller address.

Do not build a giant switch if you can do something elegant with module imports. But some techs will require a giant switch.
Do not build a business registry that repeats the module graph unless necessary.

The ideal global `control-flow` is only an address matcher:

```text
action(domain, controller, payload)
  -> match address
  -> business/{domain}/controller/{controller}
```

`control-flow` does **NOT** own behavior, branching, retry, interruption, queueing, or effects.

## The typical control-flow

### Frontend notes:

- The `Component` emits the `Input`; it does not own business branching.
- The helper converts raw input into an `action(domain, controller, payload)` and calls global `control-flow`.
- The first `effect` can be immediate feedback: loading state, disabled control, optimistic UI, telemetry, navigation, snackbar.
- `branching` belongs inside the `controller`.
- Later `helpers` do return-valued work: validation, derivation, HTTP calls, local storage, formatting.
- Final `effects` publish feedback/output: state mutation, UI invalidation, navigation, telemetry, notification.

### Backend notes:

- The route receives HTTP/event `Input` and normalizes it into an `action`.
- The `controller` owns lifecycle and branching.
- Backend `helpers` commonly perform validation, derivation, database I/O, storage I/O, or external service I/O.
- The final `effect` is usually the HTTP answer. Other no-return outputs, such as telemetry or event publish, are also `effects`.

### File Convention

Controller address should match file ownership:

```text
business/
  auth/
    action/
      login.action.ext
    controller/
      login.controller.ext
```

This maps to:

```text
domain: auth
controller: login
```

## Control-Flow Rules

- Validate that `domain` and `controller` are present.
- Resolve the address to a controller function.
- Call the controller with the `action` and runtime/context object.
- Throw or emit an implementation error when the address does not resolve.
- Do not branch on business rules.
- Do not inspect payload semantics except for address validation.
- Do not manually centralize business mappings when the language/module system can provide them.

## JavaScript || TypeScript

In JS/TS, the module graph can act as the registry.

Implementation options:

- Static imports generated from `business/*/controller/*.controller.ts`.
- Build-tool glob imports when available, such as `import.meta.glob`.
- Explicit imports only for small apps.

The root `control-flow` stays generic:

```ts
type Action = {
  domain: string
  controller: string
  payload?: unknown
}

type ControllerContext = unknown
type Controller = (action: Action, ctx: ControllerContext) => void | Promise<void>

export function createControlFlow(
  controllerByAddress: Record<string, Controller>,
  ctx: ControllerContext,
) {
  return async function controlFlow(action: Action) {
    const address = `${action.domain}.${action.controller}`
    const controller = controllerByAddress[address]

    if (!controller) {
      throw new Error(`No controller found for action address: ${address}`)
    }

    await controller(action, ctx)
  }
}
```

The `controllerByAddress` object is not business ownership. It is an import bridge.

## Flutter || Dart

Dart mobile runtimes cannot dynamically import arbitrary files at runtime. Use a generated compile-time address table.

The generated file is only a static import bridge. It is not a business registry.

Typical shape:

```text
lib/
  business/
    auth/
      action/
        login_action.dart
      controller/
        login_controller.dart
      helper/
      effect/
  runtime/
    control_flow.dart
    generated_controller_addresses.dart
```

Action address:

```dart
class ControllerAddress {
  final String domain;
  final String controller;

  const ControllerAddress({
    required this.domain,
    required this.controller,
  });

  String get key => '$domain.$controller';
}
```

Action:

```dart
class AppAction<T> {
  final ControllerAddress address;
  final T payload;

  const AppAction({
    required this.address,
    required this.payload,
  });
}
```

Action creation helper:

```dart
class LoginPayload {
  final String email;
  final String password;

  const LoginPayload({
    required this.email,
    required this.password,
  });
}

AppAction<LoginPayload> createLoginAction({
  required String email,
  required String password,
}) {
  return AppAction(
    address: const ControllerAddress(
      domain: 'auth',
      controller: 'login',
    ),
    payload: LoginPayload(email: email, password: password),
  );
}
```

Controller:

```dart
typedef Controller = Future<void> Function(
  AppAction action,
  ControllerContext ctx,
);

Future<void> loginController(
  AppAction<LoginPayload> action,
  ControllerContext ctx,
) async {
  final user = await ctx.authHelpers.findUserByEmail(action.payload.email);

  if (user == null) {
    return ctx.authEffects.showLoginError('Invalid credentials');
  }

  await ctx.authEffects.setSession(user);
}
```

Control-flow:

```dart
class ControlFlow {
  final Map<String, Controller> controllerByAddress;
  final ControllerContext ctx;

  const ControlFlow({
    required this.controllerByAddress,
    required this.ctx,
  });

  Future<void> call(AppAction action) async {
    final controller = controllerByAddress[action.address.key];

    if (controller == null) {
      throw StateError('No controller found for ${action.address.key}');
    }

    await controller(action, ctx);
  }
}
```

Generated import bridge:

```dart
import '../business/auth/controller/login_controller.dart';
import '../business/subscription/controller/confirm_controller.dart';
import 'control_flow.dart';

final controllerByAddress = <String, Controller>{
  'auth.login': loginController,
  'subscription.confirm': confirmSubscriptionController,
};
```

Generation convention:

```text
business/{domain}/controller/{controller}_controller.dart
```

maps to:

```text
{domain}.{controller}
```
