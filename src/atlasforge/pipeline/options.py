# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Share option definitions between command-line flags and interactive setup"""

import argparse
import importlib
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Option:
    """Describe one command-line option and its optional setup question"""

    name: str
    help: str
    default: Any = False
    choices: tuple[str, ...] | None = None
    metavar: str = ""
    parse: Callable[[str], Any] | None = None
    prompt: str = ""
    positional: bool = False
    multiple: bool = False

    @property
    def flag(self) -> str:
        return f"--{self.name.replace('_', '-')}"

    def default_for(self, chosen: Mapping[str, Any]) -> Any:
        return self.default(chosen) if callable(self.default) else self.default


class StepName:
    """Validate a step name without loading optional pipeline dependencies for `--help`"""

    def __init__(self, phase: str) -> None:
        self._phase = phase

    def __call__(self, value: str) -> str:
        runner = importlib.import_module(f".{self._phase}.runner", __package__)
        if value not in runner.STEP_NAMES:
            raise argparse.ArgumentTypeError(
                f"unknown step {value!r}; pick from {', '.join(runner.STEP_NAMES)}"
            )
        return value


def _help(option: Option) -> str:
    static = None if callable(option.default) else option.default
    return f"{option.help} (default: {static})" if static else option.help


def register(parser: argparse.ArgumentParser, spec: Sequence[Option]) -> None:
    for option in spec:
        kwargs: dict[str, Any] = {"default": None, "help": _help(option)}
        if option.default is False:
            # Prompted flags need both forms for the generated rerun command
            kwargs["action"] = argparse.BooleanOptionalAction if option.prompt else "store_true"
        else:
            kwargs["choices"] = option.choices
            kwargs["type"] = option.parse
            if option.metavar:
                kwargs["metavar"] = option.metavar
            if option.multiple:
                kwargs["action"] = "append"
        if option.positional:
            parser.add_argument(option.name, nargs="?", **kwargs)
        else:
            parser.add_argument(option.flag, dest=option.name, **kwargs)


def resolve(
    spec: Sequence[Option],
    args: argparse.Namespace,
    ask: Callable[[Option, Any], Any] | None = None,
) -> dict[str, Any]:
    chosen: dict[str, Any] = {}
    for option in spec:
        given = getattr(args, option.name, None)
        if given is not None:
            chosen[option.name] = given
            continue
        default = option.default_for(chosen)
        chosen[option.name] = ask(option, default) if ask and option.prompt else default
    return chosen
