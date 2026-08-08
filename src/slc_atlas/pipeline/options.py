# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""The description of an option that both pipeline command lines are built from.

Each option is declared once in cli.py and then used in two ways. register() turns it into
an argparse argument, and resolve() combines what argparse parsed with whatever the wizard
asked the user for and produces the value that a runner is given. Every argparse argument
defaults to None so that a value the user supplied can still be told apart from one they
left alone, and the real default is applied in resolve() instead.
"""

import argparse
import importlib
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Option:
    """A single input to a pipeline command, which becomes an argparse argument and, when
    prompt is set, a wizard question as well.

    An option whose default is False becomes a --flag. An option whose default is callable
    computes it from the options resolved before it, which is how the default curation
    directory is able to sit inside whichever data directory was chosen.
    """

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
    """A --step value, checked against the list of steps that the phase runner defines.

    The check is made here rather than through argparse's choices, because argparse reads
    the list of choices whenever it formats its help text. Reading the list means importing
    the runner, and the runner imports every step module it drives, so --help would then
    need the pipeline dependencies installed. Doing it this way delays the import until a
    step name actually has to be checked.
    """

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
            # A prompted flag needs its --no- form so the printed rerun command can use it
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
