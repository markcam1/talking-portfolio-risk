from pydantic import BaseModel, field_validator
from typing import Literal

VALID_RM = {
    "MV", "KT", "MAD", "GMD", "MSV", "SKT", "FLPM", "SLPM",
    "CVaR", "TG", "EVaR", "RLVaR", "WR", "RG", "CVRG", "TGRG",
    "EVRG", "RVRG", "MDD", "ADD", "CDaR", "EDaR", "RLDaR", "UCI"
}

VALID_OBJ = {"MinRisk", "Utility", "Sharpe", "MaxRet"}

VALID_METHOD_MU = {"hist", "ewma1", "ewma2", "JS", "BS", "BOP"}

VALID_METHOD_COV = {
    "hist", "ewma1", "ewma2", "ledoit", "oas", "shrunk",
    "gl", "jlogo", "fixed", "spectral", "shrink", "gerber1", "gerber2"
}


class ValidateTickersRequest(BaseModel):
    tickers: list[str]

    @field_validator("tickers")
    @classmethod
    def tickers_not_empty(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("tickers list cannot be empty")
        return [t.strip().upper() for t in v if t.strip()]


class OptimizeRequest(BaseModel):
    tickers: list[str]
    start_date: str   # YYYY-MM-DD
    end_date: str     # YYYY-MM-DD
    rm: str = "MV"
    obj: str = "Sharpe"
    rf: float = 0.0
    l: float = 2.0
    method_mu: str = "hist"
    method_cov: str = "hist"
    alpha: float = 0.05
    hist: bool = True

    @field_validator("tickers")
    @classmethod
    def tickers_valid(cls, v: list[str]) -> list[str]:
        cleaned = [t.strip().upper() for t in v if t.strip()]
        if len(cleaned) < 2:
            raise ValueError("At least 2 tickers are required for optimization")
        return cleaned

    @field_validator("rm")
    @classmethod
    def rm_valid(cls, v: str) -> str:
        if v not in VALID_RM:
            raise ValueError(f"rm must be one of: {sorted(VALID_RM)}")
        return v

    @field_validator("obj")
    @classmethod
    def obj_valid(cls, v: str) -> str:
        if v not in VALID_OBJ:
            raise ValueError(f"obj must be one of: {sorted(VALID_OBJ)}")
        return v

    @field_validator("method_mu")
    @classmethod
    def method_mu_valid(cls, v: str) -> str:
        if v not in VALID_METHOD_MU:
            raise ValueError(f"method_mu must be one of: {sorted(VALID_METHOD_MU)}")
        return v

    @field_validator("method_cov")
    @classmethod
    def method_cov_valid(cls, v: str) -> str:
        if v not in VALID_METHOD_COV:
            raise ValueError(f"method_cov must be one of: {sorted(VALID_METHOD_COV)}")
        return v

    @field_validator("alpha")
    @classmethod
    def alpha_valid(cls, v: float) -> float:
        if not (0 < v < 1):
            raise ValueError("alpha must be between 0 and 1")
        return v

    @field_validator("rf")
    @classmethod
    def rf_valid(cls, v: float) -> float:
        if v < 0:
            raise ValueError("rf (risk-free rate) cannot be negative")
        return v
