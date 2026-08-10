# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Run the optional interactive setup for `atlas fetch`"""

import argparse
import shlex
import sys
from collections.abc import Callable, Mapping, Sequence
from typing import Any

from ..config import COMMAND_NAME
from .options import Option

NO_SOURCE = (
    f"pass a source: {COMMAND_NAME} fetch 752 (HGNC group id) or a gene-list file; "
    f"see {COMMAND_NAME} fetch --help"
)

INTRO = (
    "\nA few questions before the download starts. Press Enter to take the value in\n"
    "brackets. Every one of these can also be given as a command-line flag, and the\n"
    "whole command is printed at the end so you can repeat this run without the\n"
    "questions."
)

CANCELLED = "\ncancelled"


def asker(spec: Sequence[Option], args: argparse.Namespace) -> Callable[[Option, Any], Any] | None:
    """Return an interactive prompt when the terminal and missing options require one"""
    pending = [o for o in spec if o.prompt and getattr(args, o.name, None) is None]
    if not pending or not (sys.stdin.isatty() and sys.stdout.isatty()):
        return None
    print(INTRO)
    return ask


def ask(option: Option, default: Any) -> Any:
    if option.default is False:
        return _ask_flag(option, bool(default))
    if option.choices:
        return _ask_choice(option, default)
    return _ask_value(option, default)


def command_line(command: str, spec: Sequence[Option], chosen: Mapping[str, Any]) -> str:
    """Return a reusable command containing every answer from interactive setup"""
    words = [f"{COMMAND_NAME} {command}"]
    for option in spec:
        value = chosen[option.name]
        if option.prompt or value != option.default_for(chosen):
            words.append(_word(option, value))
    return " ".join(words)


def echo(command: str) -> None:
    print("\nThe same run, without the questions:")
    print(f"  {command}\n")


def _word(option: Option, value: Any) -> str:
    if option.positional:
        return shlex.quote(str(value))
    if option.default is False:
        return option.flag if value else f"--no-{option.flag[2:]}"
    if option.multiple:
        return " ".join(f"{option.flag} {shlex.quote(str(item))}" for item in value)
    return f"{option.flag} {shlex.quote(str(value))}"


def _read(prompt: str) -> str:
    try:
        return input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        raise SystemExit(CANCELLED) from None


def _ask_value(option: Option, default: Any) -> Any:
    hint = f" [{default}]" if default else ""
    while True:
        answer = _read(f"{option.prompt}{hint}: ")
        if not answer:
            if default:
                return default
            continue
        try:
            return option.parse(answer) if option.parse else answer
        except ValueError:
            print(f"  {answer} is not a valid {option.prompt.lower()}")


def _ask_choice(option: Option, default: Any) -> Any:
    choices = option.choices or ()
    print(f"\n{option.prompt}:")
    for index, choice in enumerate(choices, start=1):
        print(f"  {index}) {choice}{'  (default)' if choice == default else ''}")
    while True:
        answer = _read("> ")
        if not answer:
            return default
        if answer in choices:
            return answer
        if answer.isdigit() and 1 <= int(answer) <= len(choices):
            return choices[int(answer) - 1]
        print(f"  answer 1-{len(choices)} or the name itself")


def _ask_flag(option: Option, default: bool) -> bool:
    hint = "Y/n" if default else "y/N"
    while True:
        answer = _read(f"{option.prompt} [{hint}]: ").lower()
        if not answer:
            return default
        if answer in ("y", "yes"):
            return True
        if answer in ("n", "no"):
            return False
        print("  answer y or n")
