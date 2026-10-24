"""
Primer / demonstration script for the hostel management system.

Walks through the core features of the ``hostel_management`` package:
creating a hostel, adding rooms, checking students in/out, generating
reports, and persisting data to JSON.

Run with:
    python primer.py
"""
from __future__ import annotations

import json
from pathlib import Path

from hostel_management import Hostel


DATA_FILE = Path("primer_demo_hostel.json")


def print_section(title: str) -> None:
    """Print a nicely formatted section heading."""
    print("\n" + "=" * 60)
    print(f" {title}")
    print("=" * 60)


def main() -> None:
    print_section("HOSTEL MANAGEMENT SYSTEM — PRIMER")
    print("Demonstrating the hostel_management domain model.\n")

    # Start a fresh hostel for the demo.
    hostel = Hostel("Green Valley Hostel")

    # ------------------------------------------------------------------
    # 1. Add rooms
    # ------------------------------------------------------------------
    print_section("1. ADDING ROOMS")
    for room_number, capacity in [("101", 2), ("102", 3), ("103", 1)]:
        room = hostel.add_room(room_number, capacity)
        print(
            f"Added room {room.room_number} "
            f"(capacity {room.capacity}, space {room.available_space})."
        )

    # Trying to add a duplicate room raises an error.
    try:
        hostel.add_room("101", 2)
    except ValueError as exc:
        print(f"Expected error: {exc}")

    # ------------------------------------------------------------------
    # 2. Check students in (add students to rooms)
    # ------------------------------------------------------------------
    print_section("2. CHECKING STUDENTS IN")
    check_ins = [
        ("Alice Sharma", "555-0101", "101", 1200.0),
        ("Bob Verma", "555-0102", "101", 1150.0),
        ("Carla Desai", "555-0103", "102", 1300.0),
        ("David Kumar", "555-0104", "102", 1250.0),
        ("Eve Reddy", "555-0105", "102", 1350.0),
    ]
    for name, phone, room_number, fee_paid in check_ins:
        student = hostel.add_student(
            name=name,
            phone=phone,
            room_number=room_number,
            fee_paid=fee_paid,
        )
        print(
            f"Checked in {student.name} "
            f"({student.student_id}) -> room {student.room_number}, "
            f"fee_paid={student.fee_paid}"
        )

    # Room 103 has capacity 1; filling it and then rejecting a second student.
    hostel.add_student("Frank Ali", "555-0106", "103", fee_paid=1100.0)
    print("Checked in Frank Ali to room 103 (capacity 1, now full).")
    try:
        hostel.add_student("Grace Mehta", "555-0107", "103", fee_paid=1100.0)
    except ValueError as exc:
        print(f"Expected error (room full): {exc}")

    # ------------------------------------------------------------------
    # 3. List rooms and students
    # ------------------------------------------------------------------
    print_section("3. CURRENT STATE")
    print("Rooms:")
    for room in hostel.list_rooms():
        print(
            f"  {room.room_number}: {room.occupancy}/{room.capacity} "
            f"occupied (space left: {room.available_space})"
        )
    print("Students:")
    for student in hostel.list_students():
        print(
            f"  {student.student_id}: {student.name} | "
            f"room {student.room_number or 'Not assigned'} | "
            f"fee_paid={student.fee_paid} | checked_in={student.checked_in}"
        )

    # ------------------------------------------------------------------
    # 4. Reports
    # ------------------------------------------------------------------
    print_section("4. HOSTEL REPORT")
    report = hostel.generate_report()
    print(json.dumps(report, indent=2))

    # ------------------------------------------------------------------
    # 5. Check out a student
    # ------------------------------------------------------------------
    print_section("5. CHECKING OUT A STUDENT")
    student_id = "STU0001"  # Alice Sharma
    student = hostel.get_student(student_id)
    print(f"Before checkout: {student.name}, room={student.room_number}")
    checked_out = hostel.checkout_student(student_id)
    print(
        f"Checked out {checked_out.name} "
        f"({checked_out.student_id}) -> room now {checked_out.room_number}"
    )
    print(f"Room 101 occupancy after checkout: {hostel.get_room('101').occupancy}")

    # ------------------------------------------------------------------
    # 6. Persist to JSON and reload
    # ------------------------------------------------------------------
    print_section("6. SAVE TO JSON AND RELOAD")
    hostel.save_to_file(DATA_FILE)
    print(f"Saved hostel data to {DATA_FILE}")

    reloaded = Hostel.load_from_file(DATA_FILE)
    print(
        f"Reloaded hostel '{reloaded.name}' with "
        f"{len(reloaded.list_rooms())} rooms and {len(reloaded.list_students())} students."
    )
    print("Reloaded report:")
    print(json.dumps(reloaded.generate_report(), indent=2))

    # Clean up the demo data file.
    DATA_FILE.unlink(missing_ok=True)
    print(f"\nCleaned up {DATA_FILE}.")

    print_section("PRIMER COMPLETE")
    print("All core features demonstrated successfully.")


if __name__ == "__main__":
    main()