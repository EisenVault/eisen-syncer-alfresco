import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Account } from '../models/account';

interface IAccount {
  id: number;
  instance_url: string;
  sync_enabled: number;
  sync_frequency: number;
  sync_in_progress: number;
  sync_path: string;
  username: string;
  last_synced_at: number;
}

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  constructor(private _http: HttpClient) { }

  getAccounts(querystring = '') {
    return this._http.get(`${environment.apiUrl}/accounts?${querystring}`);
  }

  getAccount(accountId) {
    return this._http.get<IAccount>(`${environment.apiUrl}/accounts/${accountId}`);
  }

  addAccount(params) {
    return this._http.post<Account>(
      environment.apiUrl + '/accounts',
      {
        instance_url: params.instance_url,
        username: params.username,
        password: params.password,
        sync_path: params.sync_path,
        sync_frequency: params.sync_frequency,
        sync_enabled: params.sync_enabled
      },
      {
        observe: 'response' as 'body', // to display the full response & as 'body' for type cast
        responseType: 'json'
      }
    );
  }

  updateCredentials(params) {
    return this._http.put<Account>(
      environment.apiUrl + '/accounts/credentials/' + params.accountId,
      {
        instance_url: params.instance_url,
        username: params.username,
        password: params.password
      },
      {
        observe: 'response' as 'body', // to display the full response & as 'body' for type cast
        responseType: 'json'
      }
    );
  }

  updateSyncPath(params) {
    return this._http.put<Account>(
      environment.apiUrl + '/accounts/sync_path/' + params.accountId,
      {
        sync_path: params.sync_path
      },
      {
        observe: 'response' as 'body', // to display the full response & as 'body' for type cast
        responseType: 'json'
      }
    );
  }

  updateWatchNode(
    accountId,
    selectedList
  ) {
    return this._http.post(
      `${environment.apiUrl}/accounts/${accountId}/watchnode`,
      selectedList
    );
  }

  updateSync(accountId, sync) {
    return this._http.put(`${environment.apiUrl}/accounts/${accountId}/sync`, {
      sync_enabled: sync
    });
  }

  deleteAccount(accountId, forceDelete) {
    return this._http.delete(
      `${environment.apiUrl}/accounts/${accountId}/force_delete/${forceDelete}`
    );
  }
}
