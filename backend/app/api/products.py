from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, Product, ProductVariant
from ..schemas import ProductIn, ProductUpdate, ProductVariantIn
from ..security import current_user, require_roles
from ..core.utils import serialize

router = APIRouter()


@router.get("")
def list_products(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    rows = db.scalars(select(Product).order_by(Product.id.desc()).offset(skip).limit(limit)).all()
    result = []
    for p in rows:
        item = serialize(p)
        item["variants"] = [
            serialize(v)
            for v in db.scalars(select(ProductVariant).where(ProductVariant.product_id == p.id)).all()
        ]
        result.append(item)
    return result


@router.get("/{product_id}")
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found.")
    item = serialize(p)
    item["variants"] = [
        serialize(v)
        for v in db.scalars(select(ProductVariant).where(ProductVariant.product_id == p.id)).all()
    ]
    return item


@router.post("")
def create_product(
    payload: ProductIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    p = Product(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return serialize(p)


@router.patch("/{product_id}")
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found.")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(p, field, val)
    db.commit()
    db.refresh(p)
    return serialize(p)


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found.")
    # Soft-delete: deactivate so existing subscriptions are unaffected.
    p.active = False
    db.commit()
    return {"detail": "Product deactivated successfully."}


@router.post("/{product_id}/variants")
def add_variant(
    product_id: int,
    payload: ProductVariantIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    if not db.get(Product, product_id):
        raise HTTPException(404, "Product not found.")
    v = ProductVariant(
        product_id=product_id,
        name=payload.name,
        price_adjustment=payload.price_adjustment,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return serialize(v)


@router.delete("/{product_id}/variants/{variant_id}")
def delete_variant(
    product_id: int,
    variant_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    v = db.get(ProductVariant, variant_id)
    if not v or v.product_id != product_id:
        raise HTTPException(404, "Variant not found.")
    db.delete(v)
    db.commit()
    return {"detail": "Variant deleted."}

