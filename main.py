"""Command-line interface for the hostel management system."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from hostel_management import Hostel

DEFAULT_DATA_FILE = Path("hostel_data.json")


def load_hostel(data_file: Path) -> Hostel:
    if not data_file.exists():
        return Hostel("Green Valley Hostel")
    try:
        return Hostel.load_from_file(data_file)
    except json.JSONDecodeError:
        return Hostel("Green Valley Hostel")


def save_hostel(hostel: Hostel, data_file: Path) -> None:
    hostel.save_to_file(data_file)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage hostel rooms and residents.")
    parser.add_argument("--data-file", type=Path, default=DEFAULT_DATA_FILE, help="Path to the hostel JSON data file.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    room_parser = subparsers.add_parser("add-room", help="Add a room to the hostel.")
    room_parser.add_argument("room_number")
    room_parser.add_argument("capacity", type=int)

    student_parser = subparsers.add_parser("add-student", help="Add a student to a room.")
    student_parser.add_argument("name")
    student_parser.add_argument("phone")
    student_parser.add_argument("room_number")
    student_parser.add_argument("--fee-paid", type=float, default=0.0)
    student_parser.add_argument("--student-id")

    checkout = subparsers.add_parser("checkout", help="Check out a student.")
    checkout.add_argument("student_id")

    subparsers.add_parser("rooms", help="List all rooms.")
    subparsers.add_parser("students", help="List all students.")
    subparsers.add_parser("summary", help="Show hostel summary.")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    hostel = load_hostel(args.data_file)

    if args.command == "add-room":
        room = hostel.add_room(args.room_number, args.capacity)
        save_hostel(hostel, args.data_file)
        print(f"Added room {room.room_number} with capacity {room.capacity}.")
    elif args.command == "add-student":
        student = hostel.add_student(args.name, args.phone, args.room_number, fee_paid=args.fee_paid, student_id=args.student_id)
        save_hostel(hostel, args.data_file)
        print(f"Added student {student.student_id} to room {student.room_number}.")
    elif args.command == "checkout":
        student = hostel.checkout_student(args.student_id)
        save_hostel(hostel, args.data_file)
        print(f"Checked out {student.name} ({student.student_id}).")
    elif args.command == "rooms":
        for room in hostel.list_rooms():
            print(f"{room.room_number}: {room.occupancy}/{room.capacity} occupied")
    elif args.command == "students":
        for student in hostel.list_students():
            room_text = student.room_number or "Not assigned"
            print(f"{student.student_id}: {student.name} | {room_text} | fee_paid={student.fee_paid}")
    elif args.command == "summary":
        print(json.dumps(hostel.generate_report(), indent=2))


if __name__ == "__main__":
    main()
