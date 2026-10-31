from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, Customer
from ..schemas import RegisterIn, LoginIn
from ..security import (
    hash_password, verify_password, valid_password,
    create_token, current_user, require_roles,
)

router = APIRouter()


@router.post("/register")
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if not valid_password(payload.password):
        raise HTTPException(
            422,
            "Password must be at least 9 characters and include uppercase, lowercase, and a special character.",
        )
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(409, "An account with this email already exists.")
    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role="customer",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.add(Customer(user_id=user.id, name=user.name, email=user.email))
    db.commit()
    return {
        "access_token": create_token(user),
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role},
    }


@router.post("/login")
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "Incorrect email or password.")
    if not user.is_active:
        raise HTTPException(403, "This account has been disabled. Contact your administrator.")
    return {
        "access_token": create_token(user),
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role},
    }


@router.get("/me")
def me(user: User = Depends(current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
    }


@router.post("/staff", dependencies=[Depends(require_roles("admin"))])
def create_staff(payload: RegisterIn, db: Session = Depends(get_db)):
    if not valid_password(payload.password):
        raise HTTPException(422, "Password does not meet complexity requirements.")
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(409, "Email already registered.")
    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role="staff",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}

