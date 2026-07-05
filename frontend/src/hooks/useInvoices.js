import { useCallback, useEffect, useState } from "react";

import { listInvoices } from "@/lib/invoicesApi";

import { useAddInvoice } from "@/context/AddInvoiceContext";



export function useInvoices(statusFilter = "") {

  const { refreshKey } = useAddInvoice();

  const [invoices, setInvoices] = useState([]);

  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);



  const refetch = useCallback(async () => {

    setLoading(true);

    setError(null);

    try {

      const data = await listInvoices({ status: statusFilter || undefined });

      setInvoices(data.items || []);

      setTotal(data.total ?? 0);

    } catch (err) {

      setError(err.message || "Failed to load invoices.");

      setInvoices([]);

      setTotal(0);

    } finally {

      setLoading(false);

    }

  }, [statusFilter]);



  useEffect(() => {

    refetch();

  }, [refetch, refreshKey]);



  return { invoices, total, loading, error, refetch };

}


