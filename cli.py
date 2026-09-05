#!/usr/bin/env python3
"""Grunds CLI entry point."""
import argparse

def main():
    parser = argparse.ArgumentParser(prog="grunds", description="Spatial intelligence for the café floor")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("run", help="Run ingestion + matching pipeline")
    sub.add_parser("spatial", help="Launch 3D spatial view")
    sub.add_parser("eval", help="Run evaluation harness")
    args = parser.parse_args()
    if not args.command:
        parser.print_help()
    else:
        print(f"Command: {args.command} (not yet implemented)")

if __name__ == "__main__":
    main()
