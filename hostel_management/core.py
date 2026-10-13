"""Core domain model for the hostel management system."""

from __future__ import annotations

from dataclasses import dataclass, field
import json
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Union


@dataclass
class Student:
    """Represents a resident student."""

    student_id: str
    name: str
    phone: str
    room_number: Optional[str] = None
    fee_paid: float = 0.0
    checked_in: bool = False

    def to_dict(self) -> Dict[str, object]:
        return {
            "student_id": self.student_id,
            "name": self.name,
            "phone": self.phone,
            "room_number": self.room_number,
            "fee_paid": self.fee_paid,
            "checked_in": self.checked_in,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "Student":
        return cls(
            student_id=str(data.get("student_id", "")),
            name=str(data.get("name", "")),
            phone=str(data.get("phone", "")),
            room_number=data.get("room_number"),
            fee_paid=float(data.get("fee_paid", 0.0) or 0.0),
            checked_in=bool(data.get("checked_in", False)),
        )


@dataclass
class Room:
    """Represents a room within the hostel."""

    room_number: str
    capacity: int
    students: List[Student] = field(default_factory=list)

    @property
    def available_space(self) -> int:
        return max(0, self.capacity - len(self.students))

    @property
    def occupancy(self) -> int:
        return len(self.students)

    def add_student(self, student: Student) -> None:
        if self.available_space <= 0:
            raise ValueError(f"Room {self.room_number} is full.")
        if any(existing.student_id == student.student_id for existing in self.students):
            raise ValueError(f"Student {student.student_id} is already in this room.")
        self.students.append(student)
        student.room_number = self.room_number
        student.checked_in = True

    def remove_student(self, student_id: str) -> Student:
        for index, student in enumerate(self.students):
            if student.student_id == student_id:
                removed = self.students.pop(index)
                removed.room_number = None
                removed.checked_in = False
                return removed
        raise KeyError(f"Student {student_id} not found in room {self.room_number}.")

    def to_dict(self) -> Dict[str, object]:
        return {
            "room_number": self.room_number,
            "capacity": self.capacity,
            "students": [student.to_dict() for student in self.students],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "Room":
        room = cls(
            room_number=str(data.get("room_number", "")),
            capacity=int(data.get("capacity", 0) or 0),
            students=[],
        )
        for student_data in data.get("students", []):
            student = Student.from_dict(student_data)
            room.students.append(student)
        return room


class Hostel:
    """Manages rooms, residents, and reporting for a hostel."""

    def __init__(self, name: str = "Hostel", rooms: Optional[Iterable[Room]] = None):
        self.name = name
        self.rooms: Dict[str, Room] = {}
        self.students: Dict[str, Student] = {}
        if rooms:
            for room in rooms:
                self.add_room(room.room_number, room.capacity)
                for student in room.students:
                    student.room_number = room.room_number
                    student.checked_in = True
                    self.students[student.student_id] = student
                    self.rooms[room.room_number].students.append(student)

    def add_room(self, room_number: str, capacity: int) -> Room:
        if not room_number:
            raise ValueError("Room number is required.")
        if capacity <= 0:
            raise ValueError("Capacity must be greater than zero.")
        if room_number in self.rooms:
            raise ValueError(f"Room {room_number} already exists.")
        room = Room(room_number=room_number, capacity=capacity)
        self.rooms[room_number] = room
        return room

    def get_room(self, room_number: str) -> Room:
        try:
            return self.rooms[room_number]
        except KeyError as exc:
            raise KeyError(f"Room {room_number} does not exist.") from exc

    def add_student(self, name: str, phone: str, room_number: str, fee_paid: float = 0.0, student_id: Optional[str] = None) -> Student:
        if not name or not phone:
            raise ValueError("Student name and phone are required.")
        room = self.get_room(room_number)
        if room.available_space <= 0:
            raise ValueError(f"Room {room_number} is full.")
        if student_id is None:
            student_id = self._generate_student_id()
        if student_id in self.students:
            raise ValueError(f"Student {student_id} already exists.")
        student = Student(
            student_id=student_id,
            name=name,
            phone=phone,
            fee_paid=float(fee_paid or 0.0),
            checked_in=False,
        )
        room.add_student(student)
        self.students[student.student_id] = student
        return student

    def _generate_student_id(self) -> str:
        next_number = len(self.students) + 1
        return f"STU{next_number:04d}"

    def get_student(self, student_id: str) -> Student:
        try:
            return self.students[student_id]
        except KeyError as exc:
            raise KeyError(f"Student {student_id} does not exist.") from exc

    def checkout_student(self, student_id: str) -> Student:
        student = self.get_student(student_id)
        if student.room_number is None:
            raise ValueError(f"Student {student_id} is not currently checked in.")
        room = self.get_room(student.room_number)
        room.remove_student(student_id)
        self.students[student_id] = student
        return student

    def remove_room(self, room_number: str) -> Room:
        room = self.get_room(room_number)
        if room.students:
            raise ValueError(f"Cannot remove room {room_number} while it still has residents.")
        del self.rooms[room_number]
        return room

    def list_students(self) -> List[Student]:
        return list(self.students.values())

    def list_rooms(self) -> List[Room]:
        return list(self.rooms.values())

    def occupancy_rate(self) -> float:
        total_capacity = sum(room.capacity for room in self.rooms.values())
        if total_capacity == 0:
            return 0.0
        occupied = sum(room.occupancy for room in self.rooms.values())
        return round((occupied / total_capacity) * 100, 2)

    def monthly_revenue(self) -> float:
        return round(sum(student.fee_paid for student in self.students.values() if student.checked_in), 2)

    def generate_report(self) -> Dict[str, object]:
        return {
            "name": self.name,
            "total_rooms": len(self.rooms),
            "total_capacity": sum(room.capacity for room in self.rooms.values()),
            "occupied_rooms": sum(1 for room in self.rooms.values() if room.occupancy > 0),
            "total_residents": len(self.students),
            "occupancy_rate": self.occupancy_rate(),
            "monthly_revenue": self.monthly_revenue(),
        }

    def save_to_file(self, file_path: Union[str, Path]) -> None:
        payload = {
            "name": self.name,
            "rooms": [room.to_dict() for room in self.rooms.values()],
            "students": [student.to_dict() for student in self.students.values()],
        }
        destination = Path(file_path)
        destination.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    @classmethod
    def load_from_file(cls, file_path: Union[str, Path]) -> "Hostel":
        source = Path(file_path)
        if not source.exists():
            raise FileNotFoundError(f"File {file_path} does not exist.")
        payload = json.loads(source.read_text(encoding="utf-8"))
        hostel = cls(name=str(payload.get("name", "Hostel")))
        for room_data in payload.get("rooms", []):
            room = Room.from_dict(room_data)
            hostel.rooms[room.room_number] = room
        for student_data in payload.get("students", []):
            student = Student.from_dict(student_data)
            hostel.students[student.student_id] = student
            if student.room_number and student.room_number in hostel.rooms:
                hostel.rooms[student.room_number].students.append(student)
        return hostel

    def to_dict(self) -> Dict[str, object]:
        return {
            "name": self.name,
            "rooms": [room.to_dict() for room in self.rooms.values()],
            "students": [student.to_dict() for student in self.students.values()],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "Hostel":
        hostel = cls(name=str(data.get("name", "Hostel")))
        for room_data in data.get("rooms", []):
            room = Room.from_dict(room_data)
            hostel.rooms[room.room_number] = room
        for student_data in data.get("students", []):
            student = Student.from_dict(student_data)
            hostel.students[student.student_id] = student
            if student.room_number and student.room_number in hostel.rooms:
                hostel.rooms[student.room_number].students.append(student)
        return hostel
