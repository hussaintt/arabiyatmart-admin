"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Globe2,
  Layers,
  Map,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { ErrorState, Loading } from "@/features/people/users-list";

type LocalizedName = { ar?: string; en?: string };

type Country = {
  id: number;
  code: string;
  name: LocalizedName;
  phoneCode: string;
  currency: string;
  isActive: boolean;
  _count?: { cities: number };
};

type City = {
  id: number;
  countryId: number;
  name: LocalizedName;
  isActive: boolean;
  country?: { id: number; code: string; name: LocalizedName };
  _count?: { areas: number; listings: number };
};

type Area = {
  id: number;
  cityId: number;
  name: LocalizedName;
  postalCode: string | null;
  isActive: boolean;
  city?: { id: number; name: LocalizedName };
};

type SyncResult = {
  message: string;
  citiesCreated: number;
  citiesSkipped: number;
};

export function LocationsControl({ canWrite }: { canWrite: boolean }) {
  const client = useQueryClient();
  const [activeTab, setActiveTab] = useState<"cities" | "areas">("cities");
  const [search, setSearch] = useState("");
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>("ALL");
  const [syncFeedback, setSyncFeedback] = useState<SyncResult | null>(null);

  // Modal states
  const [createCityOpen, setCreateCityOpen] = useState(false);
  const [createAreaOpen, setCreateAreaOpen] = useState(false);

  const [cityForm, setCityForm] = useState({
    countryId: "",
    nameAr: "",
    nameEn: "",
    isActive: true,
  });

  const [areaForm, setAreaForm] = useState({
    cityId: "",
    nameAr: "",
    nameEn: "",
    postalCode: "",
    isActive: true,
  });

  const countriesQuery = useQuery({
    queryKey: ["admin-locations-countries"],
    queryFn: () => adminFetch<Country[]>(adminPaths.countries),
  });

  const citiesQuery = useQuery({
    queryKey: ["admin-locations-cities"],
    queryFn: () => adminFetch<City[]>(adminPaths.cities),
  });

  const areasQuery = useQuery({
    queryKey: ["admin-locations-areas"],
    queryFn: () => adminFetch<Area[]>(adminPaths.areas),
  });

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["admin-locations-countries"] }),
      client.invalidateQueries({ queryKey: ["admin-locations-cities"] }),
      client.invalidateQueries({ queryKey: ["admin-locations-areas"] }),
    ]);
  };

  const syncEgyptMutation = useMutation({
    mutationFn: () => adminFetch<SyncResult>(adminPaths.egyptSync, { method: "POST" }),
    onSuccess: async (data) => {
      setSyncFeedback(data);
      await refresh();
    },
  });

  const toggleCityStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      adminFetch(adminPaths.city(id), {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => refresh(),
  });

  const toggleAreaStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      adminFetch(adminPaths.area(id), {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => refresh(),
  });

  const createCityMutation = useMutation({
    mutationFn: () => {
      const countryId = Number(cityForm.countryId) || (countriesQuery.data?.[0]?.id ?? 1);
      return adminFetch(adminPaths.cities, {
        method: "POST",
        body: JSON.stringify({
          countryId,
          name: { ar: cityForm.nameAr.trim(), en: cityForm.nameEn.trim() },
          isActive: cityForm.isActive,
        }),
      });
    },
    onSuccess: async () => {
      setCreateCityOpen(false);
      setCityForm({ countryId: "", nameAr: "", nameEn: "", isActive: true });
      await refresh();
    },
  });

  const createAreaMutation = useMutation({
    mutationFn: () => {
      const cityId = Number(areaForm.cityId);
      return adminFetch(adminPaths.areas, {
        method: "POST",
        body: JSON.stringify({
          cityId,
          name: { ar: areaForm.nameAr.trim(), en: areaForm.nameEn.trim() },
          postalCode: areaForm.postalCode.trim() || undefined,
          isActive: areaForm.isActive,
        }),
      });
    },
    onSuccess: async () => {
      setCreateAreaOpen(false);
      setAreaForm({ cityId: "", nameAr: "", nameEn: "", postalCode: "", isActive: true });
      await refresh();
    },
  });

  const countries = countriesQuery.data ?? [];
  const cities = citiesQuery.data ?? [];
  const areas = areasQuery.data ?? [];

  const filteredCities = useMemo(() => {
    return cities.filter((city) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      const ar = (city.name?.ar ?? "").toLowerCase();
      const en = (city.name?.en ?? "").toLowerCase();
      return ar.includes(term) || en.includes(term);
    });
  }, [cities, search]);

  const filteredAreas = useMemo(() => {
    return areas.filter((area) => {
      if (selectedCityFilter !== "ALL" && String(area.cityId) !== selectedCityFilter) {
        return false;
      }
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      const ar = (area.name?.ar ?? "").toLowerCase();
      const en = (area.name?.en ?? "").toLowerCase();
      const cityName = (area.city?.name?.ar ?? "").toLowerCase();
      return ar.includes(term) || en.includes(term) || cityName.includes(term);
    });
  }, [areas, search, selectedCityFilter]);

  const egypt = countries.find((c) => c.code === "EG") ?? countries[0];

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
            <Globe2 className="size-4 text-primary" />
            <span>التصنيف الجغرافي</span>
          </div>
          <h1 className="mt-1 text-2xl font-black md:text-3xl">المواقع والمحافظات</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            إدارة الهيكل الجغرافي لجمهورية مصر العربية: المحافظات، المدن، والمناطق المرتبطة بإعلانات السيارات ومعارض البيع.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refresh} disabled={citiesQuery.isFetching}>
            <RefreshCw className={citiesQuery.isFetching ? "size-4 animate-spin" : "size-4"} />
            <span>تحديث</span>
          </Button>
          {canWrite && (
            <Button
              variant="outline"
              className="border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
              onClick={() => syncEgyptMutation.mutate()}
              disabled={syncEgyptMutation.isPending}
            >
              <Sparkles className={syncEgyptMutation.isPending ? "size-4 animate-spin" : "size-4 text-primary"} />
              <span>{syncEgyptMutation.isPending ? "جارٍ المزامنة…" : "مزامنة محافظات مصر القياسية"}</span>
            </Button>
          )}
          {canWrite && (
            activeTab === "cities" ? (
              <Button onClick={() => setCreateCityOpen(true)}>
                <Plus className="size-4" />
                <span>إضافة محافظة</span>
              </Button>
            ) : (
              <Button onClick={() => setCreateAreaOpen(true)}>
                <Plus className="size-4" />
                <span>إضافة منطقة / حي</span>
              </Button>
            )
          )}
        </div>
      </div>

      {/* Sync Feedback Banner */}
      {syncFeedback && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            <div className="text-sm">
              <strong className="block font-bold">تمت مزامنة بيانات محافظات مصر بنجاح!</strong>
              <p className="text-xs text-muted-foreground">
                تم إنشاء {syncFeedback.citiesCreated} محافظة جديدة، وتخطي {syncFeedback.citiesSkipped} محافظة مسجلة مسبقاً.
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSyncFeedback(null)}>
            <X className="size-4" />
          </Button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground">الدولة الأساسية</CardTitle>
            <Globe2 className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{egypt?.name?.ar ?? "جمهورية مصر العربية"}</div>
            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
              Code: {egypt?.code ?? "EG"} · Phone: {egypt?.phoneCode ?? "+20"} · Currency: {egypt?.currency ?? "EGP"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground">المحافظات المسجلة</CardTitle>
            <Map className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{citiesQuery.isLoading ? "—" : cities.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">محافظات ومدن رئيسية</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground">المناطق والأحياء</CardTitle>
            <Layers className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{areasQuery.isLoading ? "—" : areas.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">أحياء فرعية ومناطق جغرافية</p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "cities" ? "default" : "outline"}
          onClick={() => {
            setActiveTab("cities");
            setSearch("");
          }}
        >
          <Map className="size-4" />
          <span>المحافظات ({cities.length})</span>
        </Button>
        <Button
          variant={activeTab === "areas" ? "default" : "outline"}
          onClick={() => {
            setActiveTab("areas");
            setSearch("");
          }}
        >
          <MapPin className="size-4" />
          <span>المناطق والأحياء ({areas.length})</span>
        </Button>
      </div>

      {/* Content Table Card */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>
                {activeTab === "cities" ? "دليل المحافظات المصرية" : "دليل المناطق والأحياء الفرعية"}
              </CardTitle>
              <CardDescription>
                {activeTab === "cities"
                  ? "المحافظات المتاحة للمستخدمين والمعارض لتحديد موقع الإعلان ومقر المعرض."
                  : "المناطق التابعة لكل محافظة لدعم فلترة البحث الدقيقة حسب الحي."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeTab === "areas" && (
                <div className="w-48">
                  <CustomSelect
                    value={selectedCityFilter}
                    onChange={(e) => setSelectedCityFilter(e.target.value)}
                    options={[
                      { value: "ALL", label: "كل المحافظات" },
                      ...cities.map((c) => ({
                        value: String(c.id),
                        label: c.name?.ar ?? String(c.id),
                      })),
                    ]}
                  />
                </div>
              )}
              <div className="relative sm:w-64">
                <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث بالاسم العربي أو الإنجليزي…"
                  className="ps-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {activeTab === "cities" ? (
            citiesQuery.isLoading ? (
              <Loading />
            ) : citiesQuery.error ? (
              <ErrorState error={citiesQuery.error as ApiError} />
            ) : !filteredCities.length ? (
              <div className="grid min-h-48 place-items-center text-center">
                <div>
                  <Map className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-2 font-bold">لا توجد محافظات مسجلة</p>
                  {canWrite && (
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => syncEgyptMutation.mutate()}
                      disabled={syncEgyptMutation.isPending}
                    >
                      <Sparkles className="size-3.5" />
                      <span>مزامنة المحافظات القياسية</span>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المحافظة (عربي)</TableHead>
                      <TableHead>Governorate (English)</TableHead>
                      <TableHead>الدولة</TableHead>
                      <TableHead>المناطق التابعة</TableHead>
                      <TableHead>الإعلانات النشطة</TableHead>
                      <TableHead>الحالة</TableHead>
                      {canWrite && <TableHead className="text-end">التحكم</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCities.map((city) => (
                      <TableRow key={city.id}>
                        <TableCell>
                          <strong className="block text-sm">{city.name?.ar ?? "—"}</strong>
                        </TableCell>
                        <TableCell dir="ltr" className="font-medium text-muted-foreground">
                          {city.name?.en ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{city.country?.code ?? "EG"}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{city._count?.areas ?? 0}</span> منطقة
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{city._count?.listings ?? 0}</span> إعلان
                        </TableCell>
                        <TableCell>
                          <Badge variant={city.isActive ? "default" : "secondary"}>
                            {city.isActive ? "نشط" : "معطل"}
                          </Badge>
                        </TableCell>
                        {canWrite && (
                          <TableCell className="text-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={toggleCityStatus.isPending}
                              onClick={() =>
                                toggleCityStatus.mutate({ id: city.id, isActive: !city.isActive })
                              }
                            >
                              {city.isActive ? (
                                <ToggleRight className="size-5 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="size-5 text-muted-foreground" />
                              )}
                              <span className="text-xs">{city.isActive ? "تعطيل" : "تفعيل"}</span>
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            areasQuery.isLoading ? (
              <Loading />
            ) : areasQuery.error ? (
              <ErrorState error={areasQuery.error as ApiError} />
            ) : !filteredAreas.length ? (
              <div className="grid min-h-48 place-items-center text-center">
                <div>
                  <MapPin className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-2 font-bold">لا توجد مناطق أو أحياء مطابقة</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنطقة / الحي (عربي)</TableHead>
                      <TableHead>Area (English)</TableHead>
                      <TableHead>المحافظة التابعة</TableHead>
                      <TableHead>الرمز البريدي</TableHead>
                      <TableHead>الحالة</TableHead>
                      {canWrite && <TableHead className="text-end">التحكم</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAreas.map((area) => (
                      <TableRow key={area.id}>
                        <TableCell>
                          <strong className="block text-sm">{area.name?.ar ?? "—"}</strong>
                        </TableCell>
                        <TableCell dir="ltr" className="font-medium text-muted-foreground">
                          {area.name?.en ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{area.city?.name?.ar ?? `مدينة #${area.cityId}`}</Badge>
                        </TableCell>
                        <TableCell dir="ltr" className="text-xs text-muted-foreground">
                          {area.postalCode || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={area.isActive ? "default" : "secondary"}>
                            {area.isActive ? "نشط" : "معطل"}
                          </Badge>
                        </TableCell>
                        {canWrite && (
                          <TableCell className="text-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={toggleAreaStatus.isPending}
                              onClick={() =>
                                toggleAreaStatus.mutate({ id: area.id, isActive: !area.isActive })
                              }
                            >
                              {area.isActive ? (
                                <ToggleRight className="size-5 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="size-5 text-muted-foreground" />
                              )}
                              <span className="text-xs">{area.isActive ? "تعطيل" : "تفعيل"}</span>
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Modal: Create Governorate */}
      <Dialog open={createCityOpen} onOpenChange={setCreateCityOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Map className="size-5 text-primary" />
              <span>إضافة محافظة جديدة</span>
            </DialogTitle>
            <DialogDescription>
              سجل محافظة جديدة تتبع جمهورية مصر العربية لتظهر في فلاتر الإعلانات ومعارض السيارات.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>الدولة</Label>
              <Input
                value={egypt?.name?.ar ?? "جمهورية مصر العربية (EG)"}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>الاسم بالعربية</Label>
                <Input
                  value={cityForm.nameAr}
                  onChange={(e) => setCityForm({ ...cityForm, nameAr: e.target.value })}
                  placeholder="مثال: أسيوط"
                />
              </div>
              <div className="space-y-1.5">
                <Label>الاسم بالإنجليزية</Label>
                <Input
                  dir="ltr"
                  value={cityForm.nameEn}
                  onChange={(e) => setCityForm({ ...cityForm, nameEn: e.target.value })}
                  placeholder="e.g. Asyut"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={cityForm.isActive}
                onChange={(e) => setCityForm({ ...cityForm, isActive: e.target.checked })}
              />
              <span>تفعيل المحافظة مباشرة فور الإنشاء</span>
            </label>
            {createCityMutation.error && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {(createCityMutation.error as ApiError).message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCityOpen(false)}>
              إلغاء
            </Button>
            <Button
              disabled={createCityMutation.isPending || !cityForm.nameAr.trim() || !cityForm.nameEn.trim()}
              onClick={() => createCityMutation.mutate()}
            >
              {createCityMutation.isPending ? "جارٍ الحفظ…" : "حفظ المحافظة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Create Area */}
      <Dialog open={createAreaOpen} onOpenChange={setCreateAreaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="size-5 text-primary" />
              <span>إضافة منطقة / حي فرعي</span>
            </DialogTitle>
            <DialogDescription>
              أضف حياً أو منطقة جغرافية تتبع إحدى محافظات مصر لدعم نتائج بحث أكثر دقة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>المحافظة التابعة</Label>
              <CustomSelect
                value={areaForm.cityId}
                onChange={(e) => setAreaForm({ ...areaForm, cityId: e.target.value })}
                options={[
                  { value: "", label: "اختر المحافظة…" },
                  ...cities.map((c) => ({
                    value: String(c.id),
                    label: c.name?.ar ?? String(c.id),
                  })),
                ]}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>اسم المنطقة (عربي)</Label>
                <Input
                  value={areaForm.nameAr}
                  onChange={(e) => setAreaForm({ ...areaForm, nameAr: e.target.value })}
                  placeholder="مثال: المعادي"
                />
              </div>
              <div className="space-y-1.5">
                <Label>اسم المنطقة (إنجليزي)</Label>
                <Input
                  dir="ltr"
                  value={areaForm.nameEn}
                  onChange={(e) => setAreaForm({ ...areaForm, nameEn: e.target.value })}
                  placeholder="e.g. Maadi"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>الرمز البريدي (اختياري)</Label>
              <Input
                dir="ltr"
                value={areaForm.postalCode}
                onChange={(e) => setAreaForm({ ...areaForm, postalCode: e.target.value })}
                placeholder="11728"
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={areaForm.isActive}
                onChange={(e) => setAreaForm({ ...areaForm, isActive: e.target.checked })}
              />
              <span>تفعيل المنطقة مباشرة فور الإنشاء</span>
            </label>
            {createAreaMutation.error && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {(createAreaMutation.error as ApiError).message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateAreaOpen(false)}>
              إلغاء
            </Button>
            <Button
              disabled={
                createAreaMutation.isPending ||
                !areaForm.cityId ||
                !areaForm.nameAr.trim() ||
                !areaForm.nameEn.trim()
              }
              onClick={() => createAreaMutation.mutate()}
            >
              {createAreaMutation.isPending ? "جارٍ الحفظ…" : "حفظ المنطقة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
