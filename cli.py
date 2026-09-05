#!/usr/bin/env python3
"""Grunds CLI entry point."""
import argparse

def main():
    parser = argparse.ArgumentParser(prog="grunds", description="Grunds — The District: a live 3D coffee economy")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("run", help="Generate waves and run the day loop")
    sub.add_parser("spatial", help="Launch the Three.js floor")
    sub.add_parser("eval", help="Score the demo loop")
    args = parser.parse_args()
    if not args.command:
        parser.print_help()
    else:
        print(f"Command: {args.command} (not yet implemented)")

if __name__ == "__main__":
    main()
