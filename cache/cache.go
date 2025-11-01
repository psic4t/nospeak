package cache

import (
	"log"
	"sync"
)

var (
	cacheInstance Cache
	cacheOnce     sync.Once
)

func InitializeCache(cacheType string) error {
	var err error
	cacheOnce.Do(func() {
		switch cacheType {
		case "sqlite", "":
			cacheInstance, err = NewSQLiteCache()
		default:
			log.Printf("Unknown cache type '%s', defaulting to SQLite", cacheType)
			cacheInstance, err = NewSQLiteCache()
		}
	})
	return err
}

func GetCache() Cache {
	if cacheInstance == nil {
		// Fallback to SQLite if not initialized
		cacheOnce.Do(func() {
			instance, err := NewSQLiteCache()
			if err != nil {
				panic(err)
			}
			cacheInstance = instance
		})
	}
	return cacheInstance
}
