from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, get_write_user
from app.models.organization import Organization, Site
from app.models.user import User
from app.schemas.organization import OrganizationCreate, OrganizationOut, SiteCreate, SiteOut

router = APIRouter()


def _site_out(site: Site) -> SiteOut:
    return SiteOut(id=site.id, name=site.name, location=site.location, organization_id=site.organization_id)


def _org_out(org: Organization) -> OrganizationOut:
    return OrganizationOut(
        id=org.id,
        name=org.name,
        description=org.description,
        sites=[_site_out(s) for s in (org.sites or [])],
    )


def _orgs_query():
    return select(Organization).options(selectinload(Organization.sites))


@router.get("/", response_model=list[OrganizationOut])
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(_orgs_query())
    return [_org_out(o) for o in result.scalars().all()]


@router.post("/", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    org = Organization(**body.model_dump())
    db.add(org)
    await db.commit()
    result = await db.execute(_orgs_query().where(Organization.id == org.id))
    return _org_out(result.scalar_one())


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organizasyon bulunamadı")
    await db.delete(org)
    await db.commit()


@router.get("/{org_id}/sites", response_model=list[SiteOut])
async def list_sites(
    org_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Site).where(Site.organization_id == org_id))
    return [_site_out(s) for s in result.scalars().all()]


@router.post("/{org_id}/sites", response_model=SiteOut, status_code=status.HTTP_201_CREATED)
async def create_site(
    org_id: int,
    body: SiteCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    site = Site(organization_id=org_id, name=body.name, location=body.location)
    db.add(site)
    await db.commit()
    await db.refresh(site)
    return _site_out(site)


@router.delete("/{org_id}/sites/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_site(
    org_id: int,
    site_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.organization_id == org_id)
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site bulunamadı")
    await db.delete(site)
    await db.commit()
